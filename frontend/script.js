class RoomFinder {
    constructor() {
        this.data = [];
        this.buildingRooms = {};
        this.init();
    }

    init() {
        this.setDefaultDateTime();
        this.bindEvents();
        this.loadData();
    }

    setDefaultDateTime() {
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

        document.getElementById('date').value = now.toISOString().split('T')[0];
        document.getElementById('startTime').value = now.toTimeString().substring(0, 5);
        document.getElementById('endTime').value = nextHour.toTimeString().substring(0, 5);
    }

    bindEvents() {
        const form = document.getElementById('roomFinderForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchRooms();
        });
    }

    async loadData() {
        try {
            const [buildingResponse, scheduleResponse] = await Promise.all([
                fetch('./data/building.json'),
                fetch('./data/schedule.jsonl')
            ]);

            this.buildingRooms = await buildingResponse.json();
            const text = await scheduleResponse.text();
            this.data = text.trim().split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
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
        const resultsContainer = document.getElementById('roomList');
        const buildingName = document.getElementById('uBuilding').selectedOptions[0].text;

        if (rooms.length === 0) {
            resultsContainer.innerHTML = `
                <div class="building-info">
                    <strong>${buildingName}</strong> - ${searchParams.date} ${searchParams.startTime} ~ ${searchParams.endTime}
                </div>
                <p class="no-results">해당 조건에 맞는 강의실을 찾을 수 없습니다.</p>
            `;
            return;
        }

        const availableCount = rooms.filter(room => room.available).length;
        const buildingInfo = `
            <div class="building-info">
                <strong>${buildingName}</strong> - ${searchParams.date} ${searchParams.startTime} ~ ${searchParams.endTime}<br>
                전체 강의실 ${rooms.length}개 중 사용 가능한 강의실 ${availableCount}개<br>
                <small style="color: #666;">📅 강의실을 클릭하면 주간 일정을 확인할 수 있습니다</small>
            </div>
        `;

        const roomsHTML = rooms.map(room => {
            const statusClass = room.available ? 'available' : 'occupied';
            const statusText = room.available ? '사용 가능' : '사용 중';
            const roomNameEncoded = encodeURIComponent(room.room_name);

            return `
                <div class="room-item clickable" data-room-name="${roomNameEncoded}" data-building-id="${room.building_id}" data-date="${searchParams.date}">
                    <div class="room-header">
                        <h3 class="room-name">${room.room_name}</h3>
                        <span class="availability-status ${statusClass}">${statusText}</span>
                    </div>
                    ${this.getRoomDetails(room)}
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = buildingInfo + roomsHTML;
        this.addRoomClickHandlers();
    }

    getRoomDetails(room) {
        if (room.available) {
            return `<div class="room-details">이 시간대에 사용 가능합니다.</div>`;
        } else {
            const conflicts = room.conflicts.map(conflict =>
                `${conflict.time}: ${conflict.title}`
            ).join('<br>');

            return `
                <div class="room-details">
                    <strong>사용 중인 수업:</strong><br>
                    ${conflicts}
                </div>
            `;
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('results').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('results').style.display = 'block';
    }

    addRoomClickHandlers() {
        document.querySelectorAll('.room-item.clickable').forEach(item => {
            item.addEventListener('click', () => {
                item.style.backgroundColor = '#e0f2fe';
                setTimeout(() => item.style.backgroundColor = '', 200);

                const { roomName: roomNameAttr, buildingId, date } = item.dataset;
                if (!roomNameAttr || !buildingId || !date) return;

                const roomName = decodeURIComponent(roomNameAttr);
                this.showWeeklySchedule(roomName, buildingId, date);
            });
        });
    }
    
    showWeeklySchedule(roomName, buildingId, selectedDate) {
        const { startDate, endDate } = this.getWeekRange(selectedDate);
        const [startKey, endKey] = [startDate, endDate].map(this.formatDateKey);

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
            list.sort((a, b) =>
                this.timeToMinutes(a.time.split(' - ')[0]) -
                this.timeToMinutes(b.time.split(' - ')[0])
            );
        });

        const weekDates = this.getWeekDates(startDate);
        const searchedDateKey = selectedDate;

        const dayColumns = weekDates.map((date, index) => {
            const dateKey = this.formatDateKey(date);
            const daySchedules = schedulesByDate.get(dateKey) || [];
            const isSearchedDate = dateKey === searchedDateKey;
            const scheduleItems = daySchedules.length === 0
                ? '<div class="day-empty">일정 없음</div>'
                : daySchedules.map(schedule => `
                    <div class="schedule-item">
                        <div class="schedule-time">${schedule.time}</div>
                        <div class="schedule-title">${schedule.title}</div>
                    </div>
                `).join('');

            return `
                <div class="day-column${isSearchedDate ? ' selected-date' : ''}" id="day-${index}">
                    <div class="day-header${isSearchedDate ? ' selected-date-header' : ''}">
                        <span class="day-name">${this.getKoreanWeekday(date.getDay())}요일${isSearchedDate ? ' (검색일)' : ''}</span>
                        <span class="day-date">${this.formatKoreanDate(date)}</span>
                    </div>
                    <div class="day-body">${scheduleItems}</div>
                </div>
            `;
        }).join('');

        const modalHTML = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${roomName} - ${startKey} ~ ${endKey} 주간 일정</h3>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="weekly-schedule">${dayColumns}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Auto-scroll to searched date's column after modal is added
        setTimeout(() => {
            const selectedColumn = document.querySelector('.day-column.selected-date');
            if (selectedColumn) {
                selectedColumn.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }, 100);
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