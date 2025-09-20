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
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.searchRooms();
        });
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
        const resultsContainer = document.getElementById('roomList');
        const buildingSelect = document.getElementById('uBuilding');
        const buildingName = buildingSelect.options[buildingSelect.selectedIndex].text;

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
        const totalCount = rooms.length;

        let html = `
            <div class="building-info">
                <strong>${buildingName}</strong> - ${searchParams.date} ${searchParams.startTime} ~ ${searchParams.endTime}<br>
                전체 강의실 ${totalCount}개 중 사용 가능한 강의실 ${availableCount}개
            </div>
        `;

        rooms.forEach(room => {
            const statusClass = room.available ? 'available' : 'occupied';
            const statusText = room.available ? '사용 가능' : '사용 중';

            const roomNameEncoded = room.room_name.replace(/"/g, '&quot;');
            html += `
                <div class="room-item clickable" data-room-name="${roomNameEncoded}" data-building-id="${room.building_id}" data-date="${searchParams.date}">
                    <div class="room-header">
                        <h3 class="room-name">${room.room_name}</h3>
                        <span class="availability-status ${statusClass}">${statusText}</span>
                    </div>
                    ${this.getRoomDetails(room)}
                    <div class="click-hint">
                        <small style="color: #888;">📅 클릭하면 하루 전체 일정을 확인할 수 있습니다</small>
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;

        // Add click handlers to room items
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
        const roomItems = document.querySelectorAll('.room-item.clickable');
        console.log(`Adding click handlers to ${roomItems.length} room items`);
        roomItems.forEach(item => {
            item.addEventListener('click', () => {
                // Visual feedback
                item.style.backgroundColor = '#e0f2fe';
                setTimeout(() => {
                    item.style.backgroundColor = '';
                }, 200);

                const roomName = item.dataset.roomName.replace(/&quot;/g, '"');
                const buildingId = item.dataset.buildingId;
                const date = item.dataset.date;
                console.log(`Clicked room: ${roomName}, Building: ${buildingId}, Date: ${date}`);
                this.showDailySchedule(roomName, buildingId, date);
            });
        });
    }

    showDailySchedule(roomName, buildingId, date) {
        console.log(`Showing daily schedule for: ${roomName}, ${buildingId}, ${date}`);
        console.log(`Total data records: ${this.data.length}`);

        // Get all schedules for this room on this date
        const roomSchedules = this.data.filter(record =>
            record.room_name === roomName &&
            record.building_id === buildingId &&
            record.date === date
        );

        console.log(`Found ${roomSchedules.length} schedules for this room on this date`);

        // Sort by time
        roomSchedules.sort((a, b) => {
            const timeA = this.timeToMinutes(a.time.split(' - ')[0]);
            const timeB = this.timeToMinutes(b.time.split(' - ')[0]);
            return timeA - timeB;
        });

        // Create modal content
        let scheduleHtml = `
            <div class="modal-overlay" onclick="this.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${roomName} - ${date} 전체 일정</h3>
                        <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
        `;

        if (roomSchedules.length === 0) {
            scheduleHtml += `
                <div class="no-schedule">
                    <p>이 날짜에는 예정된 수업이 없습니다.</p>
                    <p class="available-all-day">하루 종일 사용 가능합니다.</p>
                </div>
            `;
        } else {
            scheduleHtml += '<div class="schedule-list">';
            roomSchedules.forEach(schedule => {
                scheduleHtml += `
                    <div class="schedule-item">
                        <div class="schedule-time">${schedule.time}</div>
                        <div class="schedule-title">${schedule.title}</div>
                    </div>
                `;
            });
            scheduleHtml += '</div>';
        }

        scheduleHtml += `
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', scheduleHtml);
        console.log('Modal added to page');
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