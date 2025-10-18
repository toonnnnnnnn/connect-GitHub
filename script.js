// Motivational quotes for Form
const motivationalQuotes = [
    "You are capable of amazing things, Form! Keep pushing forward! 💪✨",
    "Every study session brings you closer to your dreams. You've got this! 🌟📚",
    "Believe in yourself - you're incredible! 💪",
    "Hard work today leads to great tomorrows. Keep going! 🌸",
    "You're not just studying, you're building your future. Great job! 🎯",
    "Every challenge you face makes you stronger. You're doing amazing! 💪",
    "Your dedication is inspiring. Keep shining, Form! ✨🌟",
    "Remember: you're not alone in this journey. I'm here cheering you on! 💪",
    "Your efforts today will pay off tomorrow. Keep believing in yourself! 🌈",
    "You're writing your own success story, and it's going to be great! 📖💫",
    "Every step forward is progress. You're doing great! 👣",
    "Your determination is your superpower. Use it well! 🦸‍♀️✨",
    "Study hard, dream big, and remember you've got this! 💪📚",
    "You're not just learning subjects, you're learning to be unstoppable! 🚀",
    "Keep going, Form! Your future self will thank you for today's efforts! 🙏"
];

// Study encouragement messages
const studyEncouragements = [
    "Take a deep breath and remember why you started! 🌸",
    "You're one step closer to your goals with every page you read! 📖",
    "Your hard work is building a beautiful future! ✨",
    "Every moment of focus is an investment in your dreams! 💫",
    "You're stronger than any challenge that comes your way! 💪"
];

// Flower animation and interaction
function giveFlower() {
    const flower = document.getElementById('flower');
    const button = document.querySelector('.give-flower-btn');
    
    // Add bounce animation
    flower.classList.add('animate');
    
    // Change button text temporarily
    const originalText = button.textContent;
    button.textContent = '🌸 Flower Given! 🌸';
    button.style.background = 'linear-gradient(45deg, #4CAF50, #45a049)';
    
    // Create floating hearts animation
    createFloatingHearts();
    
    // Reset after animation
    setTimeout(() => {
        flower.classList.remove('animate');
        button.textContent = originalText;
        button.style.background = 'linear-gradient(45deg, #ff6b9d, #ff8fab)';
    }, 600);
    
    // Show special message
    showSpecialMessage();
}

function createFloatingHearts() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const heart = document.createElement('div');
            heart.innerHTML = '💕';
            heart.style.position = 'fixed';
            heart.style.fontSize = '20px';
            heart.style.left = Math.random() * window.innerWidth + 'px';
            heart.style.top = '100%';
            heart.style.zIndex = '1000';
            heart.style.pointerEvents = 'none';
            heart.style.animation = 'floatUp 3s ease-out forwards';
            
            document.body.appendChild(heart);
            
            setTimeout(() => {
                heart.remove();
            }, 3000);
        }, i * 200);
    }
}

function showSpecialMessage() {
    const messages = [
        "A flower for Form! 💕🌸",
        "You deserve a nice flower! 🌺",
        "This flower is for you! 🌸✨",
        "Sending you a flower! 💕🌷"
    ];
    
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    // Create temporary message
    const messageDiv = document.createElement('div');
    messageDiv.textContent = randomMessage;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '50%';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translate(-50%, -50%)';
    messageDiv.style.background = 'rgba(255, 255, 255, 0.95)';
    messageDiv.style.padding = '20px 30px';
    messageDiv.style.borderRadius = '15px';
    messageDiv.style.fontSize = '1.2rem';
    messageDiv.style.fontWeight = '600';
    messageDiv.style.color = '#d63384';
    messageDiv.style.zIndex = '1001';
    messageDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    messageDiv.style.animation = 'fadeInOut 3s ease-in-out forwards';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Get daily motivation
function getMotivation() {
    const motivationText = document.getElementById('motivationText');
    const button = document.querySelector('.motivation-btn');
    
    // Add loading effect
    button.textContent = '✨ Getting your motivation... ✨';
    button.disabled = true;
    
    setTimeout(() => {
        const randomQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
        motivationText.textContent = randomQuote;
        
        // Add typing effect
        motivationText.style.opacity = '0';
        setTimeout(() => {
            motivationText.style.opacity = '1';
            motivationText.style.transition = 'opacity 0.5s ease';
        }, 100);
        
        // Reset button
        button.textContent = '✨ Get Today\'s Motivation ✨';
        button.disabled = false;
        
        // Add celebration effect
        createConfetti();
    }, 1000);
}

function createConfetti() {
    const colors = ['#ff6b9d', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.width = '10px';
            confetti.style.height = '10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.left = Math.random() * window.innerWidth + 'px';
            confetti.style.top = '-10px';
            confetti.style.zIndex = '1000';
            confetti.style.pointerEvents = 'none';
            confetti.style.borderRadius = '50%';
            confetti.style.animation = `confettiFall ${2 + Math.random() * 3}s linear forwards`;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 5000);
        }, i * 50);
    }
}

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        to {
            transform: translateY(-100vh);
            opacity: 0;
        }
    }
    
    @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize page with welcome message
document.addEventListener('DOMContentLoaded', function() {
    // Add a subtle welcome animation
    setTimeout(() => {
        const welcomeMessage = document.createElement('div');
        welcomeMessage.innerHTML = 'Welcome, Form! 💪';
        welcomeMessage.style.position = 'fixed';
        welcomeMessage.style.top = '20px';
        welcomeMessage.style.right = '20px';
        welcomeMessage.style.background = 'rgba(255, 255, 255, 0.9)';
        welcomeMessage.style.padding = '10px 20px';
        welcomeMessage.style.borderRadius = '25px';
        welcomeMessage.style.fontSize = '1rem';
        welcomeMessage.style.fontWeight = '600';
        welcomeMessage.style.color = '#d63384';
        welcomeMessage.style.zIndex = '1000';
        welcomeMessage.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
        welcomeMessage.style.animation = 'fadeInOut 4s ease-in-out forwards';
        
        document.body.appendChild(welcomeMessage);
        
        setTimeout(() => {
            welcomeMessage.remove();
        }, 4000);
    }, 2000);
});

// Add smooth scrolling for better UX
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add keyboard shortcuts for better interaction
document.addEventListener('keydown', function(e) {
    if (e.key === 'f' || e.key === 'F') {
        giveFlower();
    }
    if (e.key === 'm' || e.key === 'M') {
        getMotivation();
    }
});

// Add a special surprise for Form
function addSpecialSurprise() {
    // This could be expanded with more interactive features
    console.log('💕 Special surprise for Form! 💕');
}

// Photo upload functionality
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const photoUpload = document.getElementById('photoUpload');
    const formPhoto = document.getElementById('formPhoto');
    const photoPlaceholder = document.getElementById('photoPlaceholder');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');

    // Click to upload
    uploadArea.addEventListener('click', function() {
        photoUpload.click();
    });

    // Drag and drop functionality
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.style.background = 'rgba(255, 107, 157, 0.15)';
        uploadArea.style.borderColor = '#ff8fab';
    });

    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.style.background = 'rgba(255, 107, 157, 0.05)';
        uploadArea.style.borderColor = '#ff6b9d';
    });

    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.style.background = 'rgba(255, 107, 157, 0.05)';
        uploadArea.style.borderColor = '#ff6b9d';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    // File input change
    photoUpload.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    function handleFileUpload(file) {
        // Check if it's an image
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file! 📸');
            return;
        }

        // Show progress
        uploadProgress.style.display = 'block';
        progressFill.style.width = '0%';
        progressText.textContent = 'Uploading...';

        // Simulate upload progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 30;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 200);

        // Create FileReader to read the image
        const reader = new FileReader();
        
        reader.onload = function(e) {
            // Complete progress
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            progressText.textContent = 'Upload complete! 🎉';
            
            // Update the photo
            formPhoto.src = e.target.result;
            formPhoto.style.display = 'block';
            photoPlaceholder.style.display = 'none';
            
            // Hide progress after a moment
            setTimeout(() => {
                uploadProgress.style.display = 'none';
                progressFill.style.width = '0%';
            }, 2000);

            // Show success message
            showUploadSuccess();
        };

        reader.onerror = function() {
            clearInterval(progressInterval);
            uploadProgress.style.display = 'none';
            alert('Error uploading image. Please try again! 😔');
        };

        // Start reading the file
        reader.readAsDataURL(file);
    }

    function showUploadSuccess() {
        const successMessage = document.createElement('div');
        successMessage.innerHTML = 'Photo uploaded successfully! 📸✨';
        successMessage.style.position = 'fixed';
        successMessage.style.top = '20px';
        successMessage.style.right = '20px';
        successMessage.style.background = 'rgba(76, 175, 80, 0.9)';
        successMessage.style.color = 'white';
        successMessage.style.padding = '15px 25px';
        successMessage.style.borderRadius = '25px';
        successMessage.style.fontSize = '1rem';
        successMessage.style.fontWeight = '600';
        successMessage.style.zIndex = '1000';
        successMessage.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
        successMessage.style.animation = 'fadeInOut 3s ease-in-out forwards';
        
        document.body.appendChild(successMessage);
        
        setTimeout(() => {
            successMessage.remove();
        }, 3000);
    }
});
