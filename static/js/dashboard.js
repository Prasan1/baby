// Dashboard JavaScript with quick actions
$(document).ready(function() {
    // Load recent activities on page load
    loadRecentActivities();
    
    // Quick action card click handlers
    $('.dashboard-card').on('click', function(e) {
        e.preventDefault();
        var link = $(this).find('.card-button').attr('href');
        if (link) {
            window.location.href = link;
        }
    });
    
    // Make card buttons work when clicked directly
    $('.card-button').on('click', function(e) {
        e.stopPropagation(); // Prevent card click
    });
    
    // Refresh recent activities every 5 minutes
    setInterval(loadRecentActivities, 5 * 60 * 1000);
});

async function loadRecentActivities() {
    try {
        // Load recent feeding and sleep data
        const [feedingResponse, sleepResponse] = await Promise.all([
            fetch('/api/feeding'),
            fetch('/api/sleep')
        ]);

        if (!feedingResponse.ok || !sleepResponse.ok) {
            throw new Error('Failed to fetch data');
        }

        const feedingData = await feedingResponse.json();
        const sleepData = await sleepResponse.json();

        // Combine and sort activities by timestamp
        const allActivities = [
            ...feedingData.slice(0, 5).map(item => ({...item, type: 'feeding'})),
            ...sleepData.slice(0, 5).map(item => ({...item, type: 'sleep'}))
        ].sort((a, b) => {
            const timeA = new Date(a.timestamp || a.start_time);
            const timeB = new Date(b.timestamp || b.start_time);
            return timeB - timeA;
        });

        displayRecentActivities(allActivities.slice(0, 8));
    } catch (error) {
        console.error('Error loading recent activities:', error);
        document.getElementById('recent-activities').innerHTML = 
            '<p style="color: #999; font-style: italic; text-align: center; padding: 20px;">Unable to load recent activities. <a href="/tracking">Go to tracking page</a> to view all records.</p>';
    }
}

function displayRecentActivities(activities) {
    const container = document.getElementById('recent-activities');
    
    if (!container) {
        console.warn('Recent activities container not found');
        return;
    }
    
    if (activities.length === 0) {
        container.innerHTML = '<p style="color: #999; font-style: italic; text-align: center; padding: 20px;">No recent activities. Start tracking to see data here!</p>';
        return;
    }

    const activitiesHTML = activities.map(activity => {
        const time = activity.type === 'feeding' ? activity.timestamp : activity.start_time;
        const timeFormatted = formatDateTime(time);
        
        let details = '';
        let icon = '';
        
        if (activity.type === 'feeding') {
            icon = '🍼';
            details = `${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)} feeding`;
            if (activity.amount) details += ` - ${activity.amount}ml`;
            if (activity.duration) details += ` (${activity.duration} min)`;
        } else {
            icon = '💤';
            details = 'Sleep session';
            if (activity.end_time) {
                const duration = calculateDuration(activity.start_time, activity.end_time);
                details += ` - ${duration}`;
            } else {
                details += ' - Ongoing';
            }
        }

        return `
            <div class="activity-item">
                <div class="activity-info">
                    <div class="activity-type">${icon} ${activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}</div>
                    <div class="activity-details">${details}</div>
                </div>
                <div class="activity-time">${getTimeSince(time)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = activitiesHTML;
}

function calculateDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function getTimeSince(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diff = now.getTime() - past.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 60) {
        return minutes + ' min ago';
    } else if (hours < 24) {
        return hours + ' hr ago';
    } else {
        return days + ' day' + (days !== 1 ? 's' : '') + ' ago';
    }
}