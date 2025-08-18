// Vaccines page JavaScript
var vaccineRecords = [];

$(document).ready(function() {
    // Load vaccine records
    loadVaccineRecords();
    
    // Save vaccine record
    $('#saveVaccineRecord').on('click', function() {
        saveVaccineRecord();
    });
    
    // Export vaccine records
    $('#export-vaccines').on('click', function() {
        exportVaccineRecords();
    });
    
    // Update vaccine status when records are loaded
    updateVaccineStatus();
    
    // Set default date to today
    $('#addVaccineModal').on('show.bs.modal', function() {
        var today = new Date().toISOString().split('T')[0];
        $('#addVaccineForm input[name="date_given"]').val(today);
    });
    
    // Clear form when modal closes
    $('#addVaccineModal').on('hidden.bs.modal', function() {
        $('#addVaccineForm')[0].reset();
        $('.form-control').removeClass('is-invalid');
    });
});

function loadVaccineRecords() {
    makeApiCall('GET', '/api/vaccines')
        .then(function(data) {
            vaccineRecords = data;
            updateVaccineRecordsTable();
            updateVaccineStatus();
        })
        .catch(function(error) {
            console.error('Error loading vaccine records:', error);
            showAlert('Error loading vaccine records: ' + error.message, 'danger');
        });
}

function updateVaccineRecordsTable() {
    var tableBody = $('#vaccine-records-table');
    tableBody.empty();
    
    if (vaccineRecords.length === 0) {
        tableBody.html(`
            <tr>
                <td colspan="6" class="text-center text-muted p-4">
                    <i class="bi bi-clipboard-x" style="font-size: 2rem;"></i>
                    <p class="mb-0">No vaccine records yet. Start by recording your first vaccine!</p>
                </td>
            </tr>
        `);
        return;
    }
    
    vaccineRecords.forEach(function(record) {
        var ageAtVaccination = calculateAge(record.date_given);
        var provider = record.provider || '-';
        var notes = record.notes || '-';
        
        var row = `
            <tr>
                <td>
                    <strong>${record.vaccine_name}</strong>
                    ${record.lot_number ? '<br><small class="text-muted">Lot: ' + record.lot_number + '</small>' : ''}
                </td>
                <td>${formatDate(record.date_given)}</td>
                <td>${ageAtVaccination}</td>
                <td>${provider}</td>
                <td>
                    ${notes}
                    ${record.reaction && record.reaction !== 'none' ? '<br><span class="badge bg-warning">' + record.reaction + ' reaction</span>' : ''}
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="editVaccineRecord(${record.id})" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteVaccineRecord(${record.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                    ${record.next_dose_due ? '<br><small class="text-info">Next: ' + formatDate(record.next_dose_due) + '</small>' : ''}
                </td>
            </tr>
        `;
        tableBody.append(row);
    });
}

function updateVaccineStatus() {
    // Update status badges for each vaccine in the timeline
    $('.vaccine-item').each(function() {
        var vaccineName = $(this).data('vaccine');
        var statusBadge = $(this).find('.vaccine-status .badge');
        
        // Check if this vaccine has been given
        var givenRecord = vaccineRecords.find(function(record) {
            return record.vaccine_name === vaccineName;
        });
        
        if (givenRecord) {
            statusBadge.removeClass('bg-secondary bg-warning')
                      .addClass('bg-success')
                      .text('Given on ' + formatDate(givenRecord.date_given));
            
            // Add checkmark to vaccine name
            var vaccineTitle = $(this).find('strong').first();
            if (!vaccineTitle.find('.bi-check-circle').length) {
                vaccineTitle.append(' <i class="bi bi-check-circle text-success"></i>');
            }
        } else {
            // Check if it's overdue based on typical schedule
            var isOverdue = checkIfOverdue(vaccineName);
            if (isOverdue) {
                statusBadge.removeClass('bg-secondary bg-success')
                          .addClass('bg-warning')
                          .text('Overdue');
            } else {
                statusBadge.removeClass('bg-success bg-warning')
                          .addClass('bg-secondary')
                          .text('Not Given');
            }
        }
    });
    
    // Update progress indicator
    updateVaccineProgress();
}

function checkIfOverdue(vaccineName) {
    // This is a simplified check - in a real application, you'd want to 
    // calculate based on the baby's birth date and current age
    
    // For demo purposes, we'll assume some vaccines are overdue
    // In practice, you'd calculate based on baby's age and vaccine schedule
    
    return false; // Placeholder - implement based on your requirements
}

function updateVaccineProgress() {
    var totalFirstYearVaccines = 20; // Approximate number of first-year vaccines
    var completedVaccines = vaccineRecords.length;
    var progressPercentage = Math.min((completedVaccines / totalFirstYearVaccines) * 100, 100);
    
    // Add progress bar if it doesn't exist
    if (!$('.vaccine-progress').length) {
        $('.card-title:contains("First Year Vaccine Schedule")').parent().append(`
            <div class="vaccine-progress mt-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted">Vaccination Progress</small>
                    <small class="text-muted">${completedVaccines}/${totalFirstYearVaccines}</small>
                </div>
                <div class="progress" style="height: 8px;">
                    <div class="progress-bar bg-success" role="progressbar" style="width: ${progressPercentage}%"></div>
                </div>
            </div>
        `);
    } else {
        // Update existing progress bar
        $('.vaccine-progress .progress-bar').css('width', progressPercentage + '%');
        $('.vaccine-progress small:last-child').text(`${completedVaccines}/${totalFirstYearVaccines}`);
    }
}

function saveVaccineRecord() {
    var formData = {};
    $('#addVaccineForm').serializeArray().forEach(function(field) {
        formData[field.name] = field.value;
    });
    
    // Validation
    if (!formData.vaccine_name || !formData.date_given) {
        showAlert('Please fill in all required fields.', 'danger');
        $('#addVaccineForm [required]').each(function() {
            if (!$(this).val()) {
                $(this).addClass('is-invalid');
            }
        });
        return;
    }
    
    // Validate date is not in the future
    if (new Date(formData.date_given) > new Date()) {
        showAlert('Vaccination date cannot be in the future.', 'danger');
        $('#addVaccineForm input[name="date_given"]').addClass('is-invalid');
        return;
    }
    
    var btn = $('#saveVaccineRecord');
    var originalText = btn.html();
    btn.html('<i class="bi bi-hourglass-split"></i> Saving...').prop('disabled', true);
    
    makeApiCall('POST', '/api/vaccines', formData)
        .then(function(response) {
            if (response.success) {
                showAlert('Vaccine record saved successfully!', 'success');
                $('#addVaccineModal').modal('hide');
                $('#addVaccineForm')[0].reset();
                loadVaccineRecords();
                
                // Show post-vaccination care reminder
                showPostVaccinationReminder(formData.vaccine_name);
            } else {
                showAlert('Failed to save vaccine record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error saving vaccine record: ' + error.message, 'danger');
        })
        .finally(function() {
            btn.html(originalText).prop('disabled', false);
        });
}

function editVaccineRecord(id) {
    var record = vaccineRecords.find(r => r.id === id);
    if (!record) return;
    
    // Populate form with existing data
    $('#addVaccineForm select[name="vaccine_name"]').val(record.vaccine_name);
    $('#addVaccineForm input[name="date_given"]').val(record.date_given.split('T')[0]);
    $('#addVaccineForm input[name="provider"]').val(record.provider || '');
    $('#addVaccineForm input[name="lot_number"]').val(record.lot_number || '');
    $('#addVaccineForm select[name="reaction"]').val(record.reaction || 'none');
    $('#addVaccineForm input[name="next_dose_due"]').val(record.next_dose_due ? record.next_dose_due.split('T')[0] : '');
    $('#addVaccineForm textarea[name="notes"]').val(record.notes || '');
    
    // Change modal title and button text
    $('#addVaccineModal .modal-title').text('Edit Vaccine Record');
    $('#saveVaccineRecord').text('Update Record').data('editing-id', id);
    
    $('#addVaccineModal').modal('show');
}

function deleteVaccineRecord(id) {
    if (!confirm('Are you sure you want to delete this vaccine record?')) {
        return;
    }
    
    makeApiCall('DELETE', `/api/vaccines/${id}`)
        .then(function(response) {
            if (response.success) {
                showAlert('Vaccine record deleted successfully!', 'success');
                loadVaccineRecords();
            } else {
                showAlert('Failed to delete vaccine record.', 'danger');
            }
        })
        .catch(function(error) {
            showAlert('Error deleting vaccine record: ' + error.message, 'danger');
        });
}

function exportVaccineRecords() {
    if (vaccineRecords.length === 0) {
        showAlert('No vaccine records to export.', 'warning');
        return;
    }
    
    var exportData = vaccineRecords.map(function(record) {
        return {
            'Vaccine': record.vaccine_name,
            'Date Given': formatDate(record.date_given),
            'Age at Vaccination': calculateAge(record.date_given),
            'Healthcare Provider': record.provider || '',
            'Lot Number': record.lot_number || '',
            'Reaction': record.reaction || 'none',
            'Next Dose Due': record.next_dose_due ? formatDate(record.next_dose_due) : '',
            'Notes': record.notes || ''
        };
    });
    
    exportToCSV(exportData, 'vaccine-records-' + new Date().toISOString().split('T')[0] + '.csv');
}

function showPostVaccinationReminder(vaccineName) {
    var reminderHtml = `
        <div class="alert alert-info alert-dismissible fade show mt-3" role="alert">
            <h6 class="alert-heading"><i class="bi bi-info-circle"></i> Post-Vaccination Care</h6>
            <p class="mb-2">Your baby just received <strong>${vaccineName}</strong>. Here's what to expect:</p>
            <ul class="mb-2">
                <li>Watch for mild side effects (soreness, low fever)</li>
                <li>Comfort your baby with extra cuddles</li>
                <li>Monitor temperature for 24-48 hours</li>
                <li>Call your doctor if you have concerns</li>
            </ul>
            <small class="text-muted">This reminder will disappear automatically.</small>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    $('.container').prepend(reminderHtml);
    
    // Auto-hide after 30 seconds
    setTimeout(function() {
        $('.alert-info').fadeOut();
    }, 30000);
}

// Vaccine schedule data for quick reference
var vaccineSchedule = {
    'Birth': ['HepB-1'],
    '1-2 months': ['HepB-2'],
    '2 months': ['DTaP-1', 'Hib-1', 'IPV-1', 'PCV13-1', 'RV-1'],
    '4 months': ['DTaP-2', 'Hib-2', 'IPV-2', 'PCV13-2', 'RV-2'],
    '6 months': ['DTaP-3', 'Hib-3', 'IPV-3', 'PCV13-3', 'RV-3', 'HepB-3'],
    '12-15 months': ['Hib-4', 'PCV13-4', 'MMR-1', 'Varicella-1', 'HepA-1']
};

// Helper function to get upcoming vaccines
function getUpcomingVaccines() {
    // This would calculate based on baby's age and completed vaccines
    // For now, return a placeholder
    return [];
}

// Reset form when modal is closed
$('#addVaccineModal').on('hidden.bs.modal', function() {
    $('#addVaccineModal .modal-title').text('Record Vaccine');
    $('#saveVaccineRecord').text('Save Vaccine Record').removeData('editing-id');
});

// Form validation feedback
$('#addVaccineForm input, #addVaccineForm select, #addVaccineForm textarea').on('input change', function() {
    $(this).removeClass('is-invalid');
});