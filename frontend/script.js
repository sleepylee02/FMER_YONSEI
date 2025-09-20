class RoomFinder {
    constructor() {
        this.data = [];
        this.buildingRooms = {};
        this.roomList = document.getElementById('roomList');
        this.roomFlashTimers = new WeakMap();
        this.handleRoomCardClick = this.handleRoomCardClick.bind(this);
        this.init();
    }

    init() {
        this.setDefaultDateTime();
        this.bindEvents();
        this.loadData();
    }

    setDefaultDateTime() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const nextHourTime = nextHour.toTimeString().split(' ')[0].substring(0, 5);

        document.getElementById('date').value = today;
        document.getElementById('startTime').value = currentTime;
        document.getElementById('endTime').value = nextHourTime;
    }

    bindEvents() {
        const form = document.getElementById('roomFinderForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.searchRooms();
            });
        }

        if (this.roomList) {
            this.roomList.addEventListener('click', this.handleRoomCardClick);
        } else {
            console.warn('Room list element is missing from the DOM.');
        }
    }

    async loadData() {
        try {
            // Load building rooms data
            const buildingResponse = await fetch('../data/building.json');
            this.buildingRooms = await buildingResponse.json();
            console.log(`Loaded building data for ${Object.keys(this.buildingRooms).length} buildings`);

            // Load schedule data
            const scheduleResponse = await fetch('../data/2025-09-15_weeks1.jsonl');
            const text = await scheduleResponse.text();

            this.data = text.trim().split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));

            console.log(`Loaded ${this.data.length} schedule records`);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('데이터를 불러오는 중 오류가 발생했습니다.');
        }
    }

    searchRooms() {
        const form = document.getElementById('roomFinderForm');
        const formData = new FormData(form);

        const searchParams = {
            date: formData.get('date'),
            startTime: formData.get('startTime'),
            endTime: formData.get('endTime'),
            buildingId: formData.get('uBuilding')
        };

        this.showLoading();

        setTimeout(() => {
            try {
                const availableRooms = this.findAvailableRooms(searchParams);
                this.displayResults(availableRooms, searchParams);
            } catch (error) {
                console.error('Search error:', error);
                this.showError('검색 중 오류가 발생했습니다.');
            } finally {
                this.hideLoading();
            }
        }, 500);
    }

    findAvailableRooms(params) {
        // Step 1: Get ALL rooms in the selected building from building.json
        const buildingName = this.getBuildingNameById(params.buildingId);
        const allRoomsInBuilding = this.buildingRooms[buildingName] || [];

        // Step 2: Find occupied rooms during the requested time slot
        const occupiedRoomNames = this.getOccupiedRoomNames(params);

        // Step 3: Create result array with availability status
        const roomResults = allRoomsInBuilding.map(roomName => {
            const isOccupied = occupiedRoomNames.has(roomName);
            return {
                room_name: roomName,
                building_name: buildingName,
                building_id: params.buildingId,
                available: !isOccupied,
                conflicts: isOccupied ? occupiedRoomNames.get(roomName) : []
            };
        });

        // Step 4: Sort by availability (available rooms first), then by name
        return roomResults.sort((a, b) => {
            if (a.available !== b.available) {
                return a.available ? -1 : 1;
            }
            return a.room_name.localeCompare(b.room_name);
        });
    }

    getBuildingNameById(buildingId) {
        // Convert building ID to building name using the select options
        const select = document.getElementById('uBuilding');
        const option = Array.from(select.options).find(opt => opt.value === buildingId);
        return option ? option.text : '';
    }

    getOccupiedRoomNames(params) {
        const occupiedRooms = new Map();
        const requestedDate = params.date;
        const requestedStart = this.timeToMinutes(params.startTime);
        const requestedEnd = this.timeToMinutes(params.endTime);

        this.data.forEach(record => {
            if (record.building_id === params.buildingId && record.date === requestedDate) {
                const recordStart = this.timeToMinutes(record.time.split(' - ')[0]);
                const recordEnd = this.timeToMinutes(record.time.split(' - ')[1]);

                if (this.timeRangesOverlap(requestedStart, requestedEnd, recordStart, recordEnd)) {
                    const roomName = record.room_name;
                    if (!occupiedRooms.has(roomName)) {
                        occupiedRooms.set(roomName, []);
                    }
                    occupiedRooms.get(roomName).push(record);
                }
            }
        });

        return occupiedRooms;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    timeRangesOverlap(start1, end1, start2, end2) {
        return start1 < end2 && end1 > start2;
    }

    displayResults(rooms, searchParams) {
        if (!this.roomList) {
            console.error('Room list container is not available.');
            return;
        }

        const buildingSelect = document.getElementById('uBuilding');
        const selectedOption = buildingSelect ? buildingSelect.options[buildingSelect.selectedIndex] : null;
        const buildingName = selectedOption ? selectedOption.text : '';

        const safeRooms = Array.isArray(rooms) ? rooms : [];

        this.roomList.innerHTML = '';

        const totalCount = safeRooms.length;
        const availableCount = safeRooms.reduce((count, room) => room.available ? count + 1 : count, 0);
        const summary = this.createBuildingSummary(
            buildingName,
            searchParams,
            totalCount > 0 ? availableCount : undefined,
            totalCount > 0 ? totalCount : undefined
        );

        this.roomList.appendChild(summary);

        if (totalCount === 0) {
            const message = document.createElement('p');
            message.className = 'no-results';
            message.textContent = '해당 조건에 맞는 강의실을 찾을 수 없습니다.';
            this.roomList.appendChild(message);
            return;
        }

        const fragment = document.createDocumentFragment();
        safeRooms.forEach(room => {
            fragment.appendChild(this.createRoomCard(room, searchParams));
        });

        this.roomList.appendChild(fragment);
    }

    createRoomCard(room, searchParams) {
        const card = document.createElement('article');
        card.className = 'room-item clickable';
        card.dataset.roomName = room.room_name;
        card.dataset.buildingId = room.building_id;
        card.dataset.date = searchParams.date;

        const header = document.createElement('div');
        header.className = 'room-header';

        const nameElement = document.createElement('h3');
        nameElement.className = 'room-name';
        nameElement.textContent = room.room_name;

        const status = document.createElement('span');
        status.className = `availability-status ${room.available ? 'available' : 'occupied'}`;
        status.textContent = room.available ? '사용 가능' : '사용 중';

        header.appendChild(nameElement);
        header.appendChild(status);

        card.appendChild(header);
        card.appendChild(this.createRoomDetails(room));
        card.appendChild(this.createClickHint());

        return card;
    }

    createRoomDetails(room) {
        const details = document.createElement('div');
        details.className = 'room-details';

        if (room.available) {
            details.textContent = '이 시간대에 사용 가능합니다.';
            return details;
        }

        const label = document.createElement('strong');
        label.textContent = '사용 중인 수업:';
        details.appendChild(label);

        const conflicts = Array.isArray(room.conflicts) ? room.conflicts : [];

        const list = document.createElement('ul');
        list.className = 'room-conflict-list';

        conflicts.forEach(conflict => {
            const item = document.createElement('li');
            item.textContent = `${conflict.time}: ${conflict.title}`;
            list.appendChild(item);
        });

        details.appendChild(list);

        return details;
    }

    createClickHint() {
        const hintWrapper = document.createElement('div');
        hintWrapper.className = 'click-hint';

        const hintText = document.createElement('small');
        hintText.textContent = '📅 클릭하면 주간 일정을 확인할 수 있습니다';

        hintWrapper.appendChild(hintText);

        return hintWrapper;
    }

    createBuildingSummary(buildingName, searchParams, availableCount, totalCount) {
        const summary = document.createElement('div');
        summary.className = 'building-info';

        const heading = document.createElement('div');
        const buildingLabel = document.createElement('strong');
        buildingLabel.textContent = buildingName;
        heading.appendChild(buildingLabel);
        heading.appendChild(document.createTextNode(` - ${searchParams.date} ${searchParams.startTime} ~ ${searchParams.endTime}`));
        summary.appendChild(heading);

        if (typeof availableCount === 'number' && typeof totalCount === 'number') {
            const stats = document.createElement('div');
            stats.textContent = `전체 강의실 ${totalCount}개 중 사용 가능한 강의실 ${availableCount}개`;
            summary.appendChild(stats);
        }

        return summary;
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        if (loading) {
            loading.style.display = 'block';
        }
        if (results) {
            results.style.display = 'none';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        if (loading) {
            loading.style.display = 'none';
        }
        if (results) {
            results.style.display = 'block';
        }
    }

    handleRoomCardClick(event) {
        if (!this.roomList) {
            return;
        }

        const card = event.target.closest('.room-item.clickable');
        if (!card || !this.roomList.contains(card)) {
            return;
        }

        this.flashRoomCard(card);

        const { roomName, buildingId, date } = card.dataset;

        if (!roomName || !buildingId || !date) {
            console.warn('Missing data attributes for room item', { roomName, buildingId, date });
            return;
        }

        console.log(`Clicked room: ${roomName}, Building: ${buildingId}, Date: ${date}`);
        this.showWeeklySchedule(roomName, buildingId, date);
    }

    flashRoomCard(card) {
        if (this.roomFlashTimers.has(card)) {
            clearTimeout(this.roomFlashTimers.get(card));
        }

        card.classList.add('is-activating');

        const timeoutId = setTimeout(() => {
            card.classList.remove('is-activating');
            this.roomFlashTimers.delete(card);
        }, 200);

        this.roomFlashTimers.set(card, timeoutId);
    }
    
    showWeeklySchedule(roomName, buildingId, selectedDate) {
        console.log(`Showing weekly schedule for: ${roomName}, ${buildingId}, week of ${selectedDate}`);

        const { startDate, endDate } = this.getWeekRange(selectedDate);
        const startKey = this.formatDateKey(startDate);
        const endKey = this.formatDateKey(endDate);

        const weeklySchedules = this.data.filter(record =>
            record.room_name === roomName &&
            record.building_id === buildingId &&
            record.date >= startKey &&
            record.date <= endKey
        );

        const schedulesByDate = new Map();
        weeklySchedules.forEach(schedule => {
            if (!schedulesByDate.has(schedule.date)) {
                schedulesByDate.set(schedule.date, []);
            }
            schedulesByDate.get(schedule.date).push(schedule);
        });

        schedulesByDate.forEach(list => {
            list.sort((a, b) => {
                const timeA = this.timeToMinutes(a.time.split(' - ')[0]);
                const timeB = this.timeToMinutes(b.time.split(' - ')[0]);
                return timeA - timeB;
            });
        });

        const weekDates = this.getWeekDates(startDate);

        let scheduleHtml = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${roomName} - ${this.formatDateKey(startDate)} ~ ${this.formatDateKey(endDate)} 주간 일정</h3>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="weekly-schedule">
        `;

        weekDates.forEach(date => {
            const dateKey = this.formatDateKey(date);
            const daySchedules = schedulesByDate.get(dateKey) || [];
            scheduleHtml += `
                <div class="day-column">
                    <div class="day-header">
                        <span class="day-name">${this.getKoreanWeekday(date.getDay())}요일</span>
                        <span class="day-date">${this.formatKoreanDate(date)}</span>
                    </div>
                    <div class="day-body">
            `;

            if (daySchedules.length === 0) {
                scheduleHtml += `
                        <div class="day-empty">일정 없음</div>
                `;
            } else {
                daySchedules.forEach(schedule => {
                    scheduleHtml += `
                        <div class="schedule-item">
                            <div class="schedule-time">${schedule.time}</div>
                            <div class="schedule-title">${schedule.title}</div>
                        </div>
                    `;
                });
            }

            scheduleHtml += `
                    </div>
                </div>
            `;
        });

        scheduleHtml += `
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', scheduleHtml);
        console.log('Weekly modal added to page');
    }

    getWeekRange(dateString) {
        const baseDate = this.parseDate(dateString);
        const day = baseDate.getDay();
        const diffToMonday = (day + 6) % 7;

        const startDate = new Date(baseDate);
        startDate.setDate(baseDate.getDate() - diffToMonday);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);

        return { startDate, endDate };
    }

    getWeekDates(startDate) {
        return Array.from({ length: 7 }, (_, index) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + index);
            return date;
        });
    }

    parseDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatKoreanDate(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}월 ${day}일`;
    }

    getKoreanWeekday(dayIndex) {
        const names = ['일', '월', '화', '수', '목', '금', '토'];
        return names[dayIndex] || '';
    }

    showError(message) {
        const resultsContainer = document.getElementById('roomList');
        resultsContainer.innerHTML = `
            <div class="error-message">
                ${message}
            </div>
        `;
        this.hideLoading();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RoomFinder();
});