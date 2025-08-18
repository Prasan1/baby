// Tracking page JavaScript
var feedingChart, sleepChart;
var feedingData = [];
var sleepData = [];

$(document).ready(function() {
    // Initialize charts
    initializeCharts();
    
    // Load all tracking data
    loadTrackingData();
    
    // Add feeding record
    $('#saveFeedingRecord').on('click', function() {
        saveFeedingRecord();
    });
    
    // Add sleep record  
    $('#saveSleepRecord').on('click', function() {
        saveSleepRecord();
    });
    
    // Export functions
    $('#export-feeding').on('click', function() {
        exportFeedingData();
    });
    
    $('#export-sleep').on('click', function() {
        exportSleepData();
    });
    
    // Set default times in forms
    setDefaultTimes();
    
    // Refresh data every 2 minutes
    setInterval(loadTrackingData, 2 * 60 * 1000);
});

function initializeCharts() {
    // Feeding Chart
    var feedingCtx = document.getElementById('feedingChartCanvas').getContext('2d');
    feedingChart = new Chart(feedingCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Feedings per Day',
                data: [],
                backgroundColor: chartColors.primary,
                borderColor: chartColors.primary,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Feeding Frequency'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Sleep Chart
    var sleepCtx = document.getElementById('sleepChartCanvas').getContext('2d');
    sleepChart = new Chart(sleepCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Sleep Duration (hours)',
                data: [],
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderColor: chartColors.success,
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Sleep Duration'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 24,
                    ticks: {
                        callback: function(value) {
                            return value + 'h';
                        }
                    }
                }
            }
        }
    });
}

function loadTrackingData() {
    // Load feeding data
    makeApiCall('GET', '/api/feeding')
        .then(function(data) {
            feedingData = data;
            updateFeedingChart();
            updateFeedingTable();
            updateSummaryStats();
        })
        .catch(function(error) {
            console.error('Error loading feeding data:', error);
        });
    
    // Load sleep data
    makeApiCall('GET', '/api/sleep')
        .then(function(data) {
            sleepData = data;
            updateSleepChart();
            updateSleepTable();
            updateSummaryStats();
        })
        .catch(function(error) {
            console.error('Error loading sleep data:', error);
        });
}

function updateFeedingChart() {
    // Group feedings by date
    var dailyFeedings = {};
    var today = new Date();
    
    // Initialize last 7 days
    for (var i = 6; i >= 0; i--) {
        var date = new Date(today);
        date.setDate(date.getDate() - i);
        var dateStr = date.toISOString().split('T')[0];
        dailyFeedings[dateStr] = 0;
    }
    
    // Count feedings per day
    feedingData.forEach(function(feeding) {
        var date = new Date(feeding.timestamp).toISOString().split('T')[0];
        if (dailyFeedings.hasOwnProperty(date)) {
            dailyFeedings[date]++;
        }
    });
    
    // Update chart
    var labels = Object.keys(dailyFeedings).map(function(date) {
        return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    var data = Object.values(dailyFeedings);
    
    feedingChart.data.labels = labels;
    feedingChart.data.datasets[0].data = data;
    feedingChart.update();
}

function updateSleepChart() {
    // Group sleep by date and calculate total duration
    var dailySleep = {};
    var today = new Date();
    
    // Initialize last 7 days
    for (var i = 6; i >= 0; i--) {
        var date = new Date(today);
        date.setDate(date.getDate() - i);
        var dateStr = date.toISOString().split('T')[0];
        dailySleep[dateStr] = 0;
    }
    
    // Calculate total sleep per day (in hours)
    sleepData.forEach(function(sleep) {
        if (sleep.end_time) {
            var start = new Date(sleep.start_time);
            var end = new Date(sleep.end_time);
            var date = start.toISOString().split('T')[0];
            
            if (dailySleep.hasOwnProperty(date)) {
                var hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                dailySleep[date] += hours;
            }
        }
    });
    
    // Update chart
    var labels = Object.keys(dailySleep).map(function(date) {
        return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    var data = Object.values(dailySleep).map(function(hours) {
        return Math.round(hours * 10) / 10; // Round to 1 decimal place
    });
    
    sleepChart.data.labels = labels;
    sleepChart.data.datasets[0].data = data;
    sleepChart.update();
}

function updateFeedingTable() {
    var tableBody = $('#feeding-table-body');
    tableBody.empty();
    
    if (feedingData.length === 0) {
        tableBody.html('<tr><td colspan="5" class="text-center text-muted p-4">No feeding records yet</td></tr>');
        return;
    }
    
    feedingData.slice(0, 20).forEach(function(feeding) {
        var row = `
            <tr>
                <td>${formatDateTime(feeding.timestamp)}</td>
                <td>
                    <span class="badge bg-primary">${capitalizeFirst(feeding.type)}</span>
                </td>
                <td>${feeding.amount ? feeding.amount + ' ml' : '-'}</td>
                <td>${feeding.duration ? feeding.duration + ' min' : '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteFeedingRecord(${feeding.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                    ${feeding.notes ? '<i class="bi bi-chat-dots text-info ms-1" title="' + feeding.notes + '"></i>' : ''}
                </td>
            </tr>
        `;
        tableBody.append(row);
    });
}

function updateSleepTable() {
    var tableBody = $('#sleep-table-body');
    tableBody.empty();
    
    if (sleepData.length === 0) {
        tableBody.html('<tr><td colspan="5" class="text-center text-muted p-4">No sleep records yet</td></tr>');
        return;
    }
    
    sleepData.slice(0, 20).forEach(function(sleep) {
        var duration = sleep.end_time ? calculateDuration(sleep.start_time, sleep.end_time) : 
                      '<span class="badge bg-success">Ongoing</span>';
        
        var row = `
            <tr>
                <td>${formatDateTime(sleep.start_time)}</td>
                <td>${sleep.end_time ? formatDateTime(sleep.end_time) : '<span class="text-muted">-</span>'}</td>
                <td>${duration}</td>
                <td>${sleep.notes || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSleepRecord(${sleep.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                    ${!sleep.end_time ? '<button class="btn btn-sm btn-success ms-1" onclick="endSleepRecord(' + sleep.id + ')"><i class="bi bi-stop"></i></button>' : ''}
                </td>
            </tr>
        `;
        tableBody.append(row);
    });
}

function updateSummaryStats() {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Today's feedings
    var todayFeedings = feedingData.filter(function(feeding) {
        var feedingDate = new Date(feeding.timestamp);
        feedingDate.setHours(0, 0, 0, 0);
        return feedingDate.getTime() === today.getTime();
    });
    $('#today-feedings').text(todayFeedings.length);
    
    // Today's sleep duration
    var todaySleeps = sleepData.filter(function(sleep) {
        var sleepDate = new Date(sleep.start_time);
        sleepDate.setHours(0, 0, 0, 0);
        return sleepDate.getTime() === today.getTime();
    });
    
    var totalMinutes = 0;
    var currentlyAsleep = false;
    
    todaySleeps.forEach(function(sleep) {
        if (sleep.end_time) {
            var start = new Date(sleep.start_time);
            var end = new Date(sleep.end_time);
            totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
        } else {
            currentlyAsleep = true;
            var start = new Date(sleep.start_time);
            var now = new Date();
            totalMinutes += (now.getTime() - start.getTime()) / (1000 * 60);
        }
    });
    
    var hours = Math.floor(totalMinutes / 60);
    var minutes = Math.floor(totalMinutes % 60);
    $('#today-sleep').text(hours + 'h ' + minutes + 'm');
    
    // Last feeding time
    if (feedingData.length > 0) {
        var lastFeeding = feedingData[0];
        $('#last-feeding').text(formatTime(lastFeeding.timestamp));
    }
    
    // Sleep status
    $('#sleep-status').text(currentlyAsleep ? 'Sleeping' : 'Awake');
    $('#sleep-status').removeClass('text-success text-info')
                      .addClass(currentlyAsleep ? 'text-success' : 'text-info');
}

function saveFeedingRecord() {
    var formData = {};
    $('#addFeedingForm').serializeArray().forEach(function(field) {
        if (field.name === 'amount' && field.value) {
            // Handle amount with unit
            var unit = $('#addFeedingForm select[name="amount_unit"]').val();
            formData.amount = parseFloat(field.value);
            if (unit === 'oz') {
                formData.amount = formData.amount * 29.5735; // Convert oz to ml
            }
        } else {
            formData[field.name] = field.value;
        }
    });
    
    // Validation
    if (!formData.type || !formData.timestamp) {
        showAlert('Please fill in all required fields.', 'danger');
        return;
    }
    
    var btn = $('#saveFeedingRecord');
    var originalText = btn.html();
    btn.html('<i class="bi bi-hourglass-split"></i> Saving...').prop('disabled', true);
    
    makeApiCall('POST', '/api/feeding', formData)
        .then(function(response) {
            if (response.success) {
                showAlert('Feeding recorded successfully!', 'success');
                $('#addFeedingModal').modal('hide');
                $('#addFeedingForm')[0].reset();
                loadTrackingData();
            } else {
                showAlert('Failed to save feeding record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error saving feeding record: ' + error.message, 'danger');
        })
        .finally(function() {
            btn.html(originalText).prop('disabled', false);
        });
}

function saveSleepRecord() {
    var formData = {};
    $('#addSleepForm').serializeArray().forEach(function(field) {
        formData[field.name] = field.value;
    });
    
    // Validation
    if (!formData.start_time) {
        showAlert('Please fill in the start time.', 'danger');
        return;
    }
    
    // Validate end time is after start time
    if (formData.end_time && new Date(formData.end_time) <= new Date(formData.start_time)) {
        showAlert('End time must be after start time.', 'danger');
        return;
    }
    
    var btn = $('#saveSleepRecord');
    var originalText = btn.html();
    btn.html('<i class="bi bi-hourglass-split"></i> Saving...').prop('disabled', true);
    
    makeApiCall('POST', '/api/sleep', formData)
        .then(function(response) {
            if (response.success) {
                showAlert('Sleep recorded successfully!', 'success');
                $('#addSleepModal').modal('hide');
                $('#addSleepForm')[0].reset();
                loadTrackingData();
            } else {
                showAlert('Failed to save sleep record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error saving sleep record: ' + error.message, 'danger');
        })
        .finally(function() {
            btn.html(originalText).prop('disabled', false);
        });
}

function deleteFeedingRecord(id) {
    if (!confirm('Are you sure you want to delete this feeding record?')) {
        return;
    }
    
    makeApiCall('DELETE', `/api/feeding/${id}`)
        .then(function(response) {
            if (response.success) {
                showAlert('Feeding record deleted successfully!', 'success');
                loadTrackingData();
            } else {
                showAlert('Failed to delete feeding record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error deleting feeding record: ' + error.message, 'danger');
        });
}

function deleteSleepRecord(id) {
    if (!confirm('Are you sure you want to delete this sleep record?')) {
        return;
    }
    
    makeApiCall('DELETE', `/api/sleep/${id}`)
        .then(function(response) {
            if (response.success) {
                showAlert('Sleep record deleted successfully!', 'success');
                loadTrackingData();
            } else {
                showAlert('Failed to delete sleep record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error deleting sleep record: ' + error.message, 'danger');
        });
}

function endSleepRecord(id) {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    
    makeApiCall('PUT', `/api/sleep/${id}`, {
        end_time: now.toISOString()
    })
        .then(function(response) {
            if (response.success) {
                showAlert('Sleep session ended!', 'success');
                loadTrackingData();
            } else {
                showAlert('Failed to end sleep session.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error ending sleep session: ' + error.message, 'danger');
        });
}

function exportFeedingData() {
    if (feedingData.length === 0) {
        showAlert('No feeding data to export.', 'warning');
        return;
    }
    
    var exportData = feedingData.map(function(feeding) {
        return {
            'Date': formatDate(feeding.timestamp),
            'Time': formatTime(feeding.timestamp),
            'Type': feeding.type,
            'Amount (ml)': feeding.amount || '',
            'Duration (min)': feeding.duration || '',
            'Notes': feeding.notes || ''
        };
    });
    
    exportToCSV(exportData, 'feeding-records-' + new Date().toISOString().split('T')[0] + '.csv');
}

function exportSleepData() {
    if (sleepData.length === 0) {
        showAlert('No sleep data to export.', 'warning');
        return;
    }
    
    var exportData = sleepData.map(function(sleep) {
        return {
            'Start Date': formatDate(sleep.start_time),
            'Start Time': formatTime(sleep.start_time),
            'End Date': sleep.end_time ? formatDate(sleep.end_time) : '',
            'End Time': sleep.end_time ? formatTime(sleep.end_time) : '',
            'Duration': sleep.end_time ? calculateDuration(sleep.start_time, sleep.end_time) : 'Ongoing',
            'Notes': sleep.notes || ''
        };
    });
    
    exportToCSV(exportData, 'sleep-records-' + new Date().toISOString().split('T')[0] + '.csv');
}

function setDefaultTimes() {
    // Set current time for feeding modal when opened
    $('#addFeedingModal').on('show.bs.modal', function() {
        var now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        $('#addFeedingForm input[name="timestamp"]').val(now.toISOString().slice(0, 16));
    });
    
    // Set current time for sleep modal when opened
    $('#addSleepModal').on('show.bs.modal', function() {
        var now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        $('#addSleepForm input[name="start_time"]').val(now.toISOString().slice(0, 16));
        
        // Clear end time
        $('#addSleepForm input[name="end_time"]').val('');
    });
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Auto-refresh charts when tab is changed
$('#feeding-chart-tab, #sleep-chart-tab').on('shown.bs.tab', function(e) {
    setTimeout(function() {
        if (e.target.id === 'feeding-chart-tab') {
            feedingChart.resize();
        } else if (e.target.id === 'sleep-chart-tab') {
            sleepChart.resize();
        }
    }, 100);
});