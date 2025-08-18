// Main application JavaScript
$(document).ready(function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Auto-hide alerts after 5 seconds
    $('.alert').each(function() {
        var alert = $(this);
        setTimeout(function() {
            alert.fadeOut();
        }, 5000);
    });

    // Set current datetime in datetime-local inputs
    $('input[type="datetime-local"]').each(function() {
        if (!$(this).val()) {
            var now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            $(this).val(now.toISOString().slice(0, 16));
        }
    });

    // Form validation
    $('form').on('submit', function(e) {
        var form = $(this);
        var isValid = true;

        // Check required fields
        form.find('[required]').each(function() {
            var field = $(this);
            if (!field.val().trim()) {
                field.addClass('is-invalid');
                isValid = false;
            } else {
                field.removeClass('is-invalid');
            }
        });

        if (!isValid) {
            e.preventDefault();
            showAlert('Please fill in all required fields.', 'danger');
        }
    });

    // Remove validation classes on input
    $('input, select, textarea').on('input change', function() {
        $(this).removeClass('is-invalid is-valid');
    });
});

// Utility functions
function showAlert(message, type = 'info', container = '#alert-container') {
    var alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    $(container).html(alertHtml);
    
    // Auto-hide after 5 seconds
    setTimeout(function() {
        $('.alert').fadeOut();
    }, 5000);
}

function formatDateTime(dateString) {
    var date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function formatDate(dateString) {
    var date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatTime(dateString) {
    var date = new Date(dateString);
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function calculateAge(birthDate) {
    var today = new Date();
    var birth = new Date(birthDate);
    var age = today.getTime() - birth.getTime();
    
    var days = Math.floor(age / (1000 * 60 * 60 * 24));
    var weeks = Math.floor(days / 7);
    var months = Math.floor(days / 30.44);
    
    if (days < 7) {
        return days + ' day' + (days !== 1 ? 's' : '');
    } else if (weeks < 8) {
        return weeks + ' week' + (weeks !== 1 ? 's' : '');
    } else {
        return months + ' month' + (months !== 1 ? 's' : '');
    }
}

function calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null;
    
    var start = new Date(startTime);
    var end = new Date(endTime);
    var diff = end.getTime() - start.getTime();
    
    var hours = Math.floor(diff / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    var result = '';
    if (hours > 0) {
        result += hours + 'h ';
    }
    result += minutes + 'm';
    
    return result;
}

function getTimeSince(dateString) {
    var now = new Date();
    var past = new Date(dateString);
    var diff = now.getTime() - past.getTime();
    
    var minutes = Math.floor(diff / (1000 * 60));
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    
    if (minutes < 60) {
        return minutes + ' min ago';
    } else if (hours < 24) {
        return hours + ' hr ago';
    } else {
        return days + ' day' + (days !== 1 ? 's' : '') + ' ago';
    }
}

// API helper functions
function makeApiCall(method, url, data = null) {
    return new Promise((resolve, reject) => {
        var settings = {
            url: url,
            method: method,
            contentType: 'application/json',
            success: function(response) {
                resolve(response);
            },
            error: function(xhr, status, error) {
                console.error('API Error:', error);
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText,
                    message: xhr.responseJSON ? xhr.responseJSON.message : error
                });
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            settings.data = JSON.stringify(data);
        }
        
        $.ajax(settings);
    });
}

// Export functions
function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
        showAlert('No data to export', 'warning');
        return;
    }
    
    var csv = '';
    var headers = Object.keys(data[0]);
    csv += headers.join(',') + '\n';
    
    data.forEach(function(row) {
        var values = headers.map(function(header) {
            var value = row[header];
            // Escape commas and quotes
            if (value && typeof value === 'string') {
                if (value.includes(',') || value.includes('"')) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
            }
            return value || '';
        });
        csv += values.join(',') + '\n';
    });
    
    // Create download link
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    var url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('Data exported successfully!', 'success');
}

// Loading states
function showLoading(element) {
    $(element).addClass('loading');
}

function hideLoading(element) {
    $(element).removeClass('loading');
}

// Local storage helpers
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function loadFromStorage(key, defaultValue = null) {
    try {
        var item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return defaultValue;
    }
}

// Theme handling
function toggleTheme() {
    var currentTheme = $('body').attr('data-theme') || 'light';
    var newTheme = currentTheme === 'light' ? 'dark' : 'light';
    $('body').attr('data-theme', newTheme);
    saveToStorage('theme', newTheme);
}

// Initialize theme on page load
function initializeTheme() {
    var savedTheme = loadFromStorage('theme', 'light');
    $('body').attr('data-theme', savedTheme);
}

// Call on document ready
$(document).ready(function() {
    initializeTheme();
});

// Chart color schemes
var chartColors = {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40'
};

// Chart.js default configuration
if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#6c757d';
    Chart.defaults.plugins.legend.position = 'top';
    Chart.defaults.plugins.legend.align = 'start';
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;
}

// Notification system
function showNotification(title, message, type = 'info') {
    // Check if browser supports notifications
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            var notification = new Notification(title, {
                body: message,
                icon: '/static/icons/baby-icon.png'
            });
            
            setTimeout(function() {
                notification.close();
            }, 5000);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    showNotification(title, message, type);
                }
            });
        }
    }
    
    // Fallback to alert
    showAlert(title + ': ' + message, type);
}

// Service worker registration (for offline support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/static/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registration successful');
            })
            .catch(function(error) {
                console.log('ServiceWorker registration failed');
            });
    });
}