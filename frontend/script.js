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

            html += `
                <div class="room-item">
                    <div class="room-header">
                        <h3 class="room-name">${room.room_name}</h3>
                        <span class="availability-status ${statusClass}">${statusText}</span>
                    </div>
                    ${this.getRoomDetails(room)}
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
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