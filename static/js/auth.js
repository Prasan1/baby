// Authentication JavaScript
$(document).ready(function() {
    // Login form submission
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();
        
        var email = $('#loginEmail').val().trim();
        var password = $('#loginPassword').val();
        
        if (!email || !password) {
            showAlert('Please enter both email and password.', 'danger');
            return;
        }
        
        var submitBtn = $(this).find('button[type="submit"]');
        var originalText = submitBtn.html();
        
        // Show loading state
        submitBtn.html('<i class="bi bi-hourglass-split"></i> Signing in...').prop('disabled', true);
        
        // Make login request
        $.ajax({
            url: '/login',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                email: email,
                password: password
            }),
            success: function(response) {
                if (response.success) {
                    showAlert('Login successful! Redirecting...', 'success');
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 1000);
                } else {
                    showAlert(response.message || 'Login failed. Please try again.', 'danger');
                    submitBtn.html(originalText).prop('disabled', false);
                }
            },
            error: function(xhr) {
                var message = 'Login failed. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                }
                showAlert(message, 'danger');
                submitBtn.html(originalText).prop('disabled', false);
            }
        });
    });
    
    // Registration form submission
    $('#registerSubmit').on('click', function() {
        var name = $('#registerName').val().trim();
        var email = $('#registerEmail').val().trim();
        var password = $('#registerPassword').val();
        var babyName = $('#babyName').val().trim();
        var dueDate = $('#dueDate').val();
        
        // Validation
        var isValid = true;
        var errorMessage = '';
        
        if (!name) {
            isValid = false;
            errorMessage = 'Please enter your name.';
            $('#registerName').addClass('is-invalid');
        }
        
        if (!email) {
            isValid = false;
            errorMessage = 'Please enter your email address.';
            $('#registerEmail').addClass('is-invalid');
        } else if (!isValidEmail(email)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address.';
            $('#registerEmail').addClass('is-invalid');
        }
        
        if (!password) {
            isValid = false;
            errorMessage = 'Please enter a password.';
            $('#registerPassword').addClass('is-invalid');
        } else if (password.length < 6) {
            isValid = false;
            errorMessage = 'Password must be at least 6 characters long.';
            $('#registerPassword').addClass('is-invalid');
        }
        
        if (!isValid) {
            showAlert(errorMessage, 'danger');
            return;
        }
        
        var submitBtn = $(this);
        var originalText = submitBtn.html();
        
        // Show loading state
        submitBtn.html('<i class="bi bi-hourglass-split"></i> Creating account...').prop('disabled', true);
        
        // Make registration request
        $.ajax({
            url: '/register',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                name: name,
                email: email,
                password: password,
                baby_name: babyName,
                due_date: dueDate
            }),
            success: function(response) {
                if (response.success) {
                    showAlert('Account created successfully! Redirecting...', 'success');
                    $('#registerModal').modal('hide');
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 1000);
                } else {
                    showAlert(response.message || 'Registration failed. Please try again.', 'danger');
                    submitBtn.html(originalText).prop('disabled', false);
                }
            },
            error: function(xhr) {
                var message = 'Registration failed. Please try again.';
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    message = xhr.responseJSON.message;
                }
                showAlert(message, 'danger');
                submitBtn.html(originalText).prop('disabled', false);
            }
        });
    });
    
    // Clear validation classes when user starts typing
    $('#registerName, #registerEmail, #registerPassword').on('input', function() {
        $(this).removeClass('is-invalid is-valid');
    });
    
    // Show/hide password toggle
    $('.password-toggle').on('click', function() {
        var passwordField = $(this).siblings('input');
        var icon = $(this).find('i');
        
        if (passwordField.attr('type') === 'password') {
            passwordField.attr('type', 'text');
            icon.removeClass('bi-eye').addClass('bi-eye-slash');
        } else {
            passwordField.attr('type', 'password');
            icon.removeClass('bi-eye-slash').addClass('bi-eye');
        }
    });
    
    // Auto-focus on first input when modal opens
    $('#registerModal').on('shown.bs.modal', function() {
        $('#registerName').focus();
    });
    
    // Clear form when modal is closed
    $('#registerModal').on('hidden.bs.modal', function() {
        $('#registerForm')[0].reset();
        $('.form-control').removeClass('is-invalid is-valid');
    });
    
    // Enter key handling
    $('#registerModal input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            $('#registerSubmit').click();
        }
    });
    
    $('#loginForm input').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            $('#loginForm').submit();
        }
    });
});

// Email validation function
function isValidEmail(email) {
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Password strength checker
function checkPasswordStrength(password) {
    var strength = {
        score: 0,
        feedback: []
    };
    
    if (password.length >= 8) {
        strength.score += 1;
    } else {
        strength.feedback.push('Use at least 8 characters');
    }
    
    if (/[a-z]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Include lowercase letters');
    }
    
    if (/[A-Z]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Include uppercase letters');
    }
    
    if (/\d/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Include numbers');
    }
    
    if (/[^A-Za-z0-9]/.test(password)) {
        strength.score += 1;
    } else {
        strength.feedback.push('Include special characters');
    }
    
    return strength;
}

// Show password strength indicator
$('#registerPassword').on('input', function() {
    var password = $(this).val();
    var strength = checkPasswordStrength(password);
    var indicator = $('#password-strength');
    
    if (!indicator.length) {
        $(this).after('<div id="password-strength" class="mt-1"></div>');
        indicator = $('#password-strength');
    }
    
    if (password.length === 0) {
        indicator.hide();
        return;
    }
    
    var strengthText = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    var strengthColor = ['danger', 'danger', 'warning', 'info', 'success'];
    var strengthIndex = Math.min(strength.score, 4);
    
    indicator.html(`
        <small class="text-${strengthColor[strengthIndex]}">
            Password Strength: ${strengthText[strengthIndex]}
        </small>
    `).show();
    
    if (strength.feedback.length > 0 && strength.score < 3) {
        indicator.append(`<br><small class="text-muted">${strength.feedback.join(', ')}</small>`);
    }
});