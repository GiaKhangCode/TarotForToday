let currentMode = 1;
let currentTopicId = null;
let currentQuestionId = null;
let cardsToDraw = 0;
let drawnCards = [];
let availableCards = [];

let audioEnabled = false;

const modeTitles = {
    1: ["Lá Bài Của Bạn"],
    3: ["Quá Khứ", "Hiện Tại", "Tương Lai"]
};

function initApp() {
    if (typeof BOITAROT_DATA === 'undefined') {
        alert("Dữ liệu Tarot chưa được tải. Hãy kiểm tra kết nối mạng hoặc file dữ liệu.");
        return;
    }
    
    // Populate Topics
    const topicSelect = document.getElementById('topic-select');
    topicSelect.innerHTML = '';
    
    BOITAROT_DATA.topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.name;
        topicSelect.appendChild(option);
    });
    
    // Trigger topic change to populate questions
    onTopicChange();
}

function onTopicChange() {
    const topicSelect = document.getElementById('topic-select');
    const questionSelect = document.getElementById('question-select');
    
    const selectedTopicId = parseInt(topicSelect.value);
    const topic = BOITAROT_DATA.topics.find(t => t.id === selectedTopicId);
    
    questionSelect.innerHTML = '';
    if (topic && topic.children) {
        topic.children.forEach(child => {
            const option = document.createElement('option');
            option.value = child.id;
            option.textContent = child.name;
            questionSelect.appendChild(option);
        });
    }
}

// Web Audio API Setup
let audioCtx;
let bgOsc1, bgGain, bgNoise;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function createWhiteNoiseBuffer(duration) {
    const frameCount = audioCtx.sampleRate * duration;
    const myArrayBuffer = audioCtx.createBuffer(1, frameCount, audioCtx.sampleRate);
    const nowBuffering = myArrayBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        nowBuffering[i] = Math.random() * 2 - 1;
    }
    return myArrayBuffer;
}

function playPaperSound(duration, type) {
    if (!audioEnabled || !audioCtx) return;
    const source = audioCtx.createBufferSource();
    source.buffer = createWhiteNoiseBuffer(duration);
    
    // Filter to make it sound like paper/cardboard
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = type === 'shuffle' ? 1200 : 2500; // Lower frequency for softer sound
    
    const gain = audioCtx.createGain();
    
    // Soft attack (fade in) to avoid "gunshot" click
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    
    const peakVolume = type === 'shuffle' ? 0.08 : 0.15;
    const attackTime = type === 'shuffle' ? 0.05 : 0.02;
    
    // Ramp up slowly to sound like a slide, then fade out
    gain.gain.linearRampToValueAtTime(peakVolume, audioCtx.currentTime + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
}

function playFlipSound() {
    playPaperSound(0.15, 'flip');
}

function playShuffleSound() {
    let delay = 0;
    for(let i=0; i<20; i++) {
        setTimeout(() => {
            playPaperSound(0.12, 'shuffle'); // slightly longer paper sound
        }, delay);
        delay += 60 + Math.random()*50; // Slower spacing between sounds
    }
}

// The background music is now controlled via an HTML <audio> element
// to allow the user to easily customize the track with an MP3 file.

function toggleAudio() {
    initAudio();
    const toggleBtn = document.getElementById('audio-toggle');
    const audioBg = document.getElementById('audio-bg');
    
    if (audioEnabled) {
        if(audioBg) audioBg.pause();
        toggleBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        toggleBtn.style.color = "var(--accent-gold)";
        audioEnabled = false;
    } else {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        audioEnabled = true;
        if(audioBg) {
            audioBg.volume = 0.3;
            audioBg.play().catch(e => console.log("Audio play prevented:", e));
        }
        toggleBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        toggleBtn.style.color = "#2bc966";
    }
}

function proceedToDraw() {
    if (audioEnabled) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }
    
    currentMode = parseInt(document.getElementById('mode-select').value);
    currentTopicId = parseInt(document.getElementById('topic-select').value);
    currentQuestionId = parseInt(document.getElementById('question-select').value);
    
    cardsToDraw = currentMode;
    drawnCards = [];
    
    // Setup available cards
    availableCards = [...BOITAROT_DATA.cards];
    
    // Shuffle using Fisher-Yates
    for (let i = availableCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
    }
    
    // Hide setup, show draw
    document.getElementById('setup-interface').classList.add('hidden');
    document.getElementById('result-interface').classList.add('hidden');
    
    const drawInterface = document.getElementById('draw-interface');
    drawInterface.classList.remove('hidden');
    
    // Set header text
    const questionSelect = document.getElementById('question-select');
    const questionText = questionSelect.options[questionSelect.selectedIndex].text;
    document.getElementById('selected-question-display').innerText = `"${questionText}"`;
    document.getElementById('result-question-display').innerText = `Câu hỏi: "${questionText}"`;
    
    document.getElementById('reveal-btn').classList.add('hidden');
    document.getElementById('reset-btn').classList.remove('hidden');
    
    updateDrawCount();
    generateArcSpread();
    generateSlots();
}

function generateArcSpread() {
    const container = document.getElementById('arc-container');
    container.innerHTML = '';
    
    const totalCards = 78;
    const angleSpan = 110; // Make arc flatter and wider
    const angleStep = angleSpan / totalCards;
    const startAngle = -(angleSpan / 2); // From left to right
    
    for (let i = 0; i < totalCards; i++) {
        const cardEl = document.createElement('div');
        cardEl.className = 'arc-card';
        cardEl.dataset.index = i;
        
        // Calculate angle
        const angle = startAngle + (i * angleStep) + (angleStep / 2);
        cardEl.style.transform = `rotate(${angle}deg)`;
        cardEl.style.zIndex = i + 10;
        
        cardEl.onclick = function() {
            if (this.classList.contains('picked')) return;
            drawCard(this);
        };
        
        container.appendChild(cardEl);
    }
}

function generateSlots() {
    const container = document.getElementById('spread-slots');
    container.innerHTML = '';
    for (let i = 0; i < currentMode; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.id = `slot-${i}`;
        slot.innerHTML = `<span>${modeTitles[currentMode][i] || 'Lá Bài'}</span>`;
        container.appendChild(slot);
    }
}

function shuffleCardsAnimation() {
    playShuffleSound();
    
    // Shuffle the availableCards array physically
    for (let i = availableCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
    }
    
    const container = document.getElementById('arc-container');
    const cards = container.getElementsByClassName('arc-card');
    
    // Visual shuffle effect
    for (let i = 0; i < cards.length; i++) {
        // Temporarily change transition for slower shuffling
        cards[i].style.transition = 'bottom 0.25s ease-out, margin-bottom 0.25s ease-out';
        
        // Pop cards up randomly over a longer span
        setTimeout(() => {
            cards[i].style.bottom = `${50 + Math.random() * 80}px`; // Pop up
            cards[i].style.zIndex = Math.floor(Math.random() * 100) + 10;
        }, Math.random() * 1000); // Spread pop-ups over 1 second
        
        // Return them to normal slower
        setTimeout(() => {
            cards[i].style.bottom = '50px';
        }, 1200 + Math.random() * 500); // Return between 1.2s and 1.7s
    }
    
    // Restore clean state
    setTimeout(() => {
        for (let i = 0; i < cards.length; i++) {
            cards[i].style.zIndex = i + 10;
            cards[i].style.transition = 'transform 0.3s ease, bottom 0.3s ease, margin-bottom 0.3s ease';
        }
    }, 2000); // Total animation 2 seconds
}

function updateDrawCount() {
    document.getElementById('cards-to-draw').innerText = cardsToDraw;
}

function getSafeImageFilename(title) {
    return title.replace(/[\\/*?:"<>|]/g, "");
}

function stripHtml(html) {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function drawCard(element) {
    if (cardsToDraw <= 0) return;
    
    playFlipSound();
    
    // Mark card as picked in the arc
    element.classList.add('picked');
    
    // Actual logic: pick a random card from available pool
    const randIndex = Math.floor(Math.random() * availableCards.length);
    const cardData = availableCards[randIndex];
    availableCards.splice(randIndex, 1); // remove
    
    const isReversed = Math.random() > 0.5;
    
    const cardObj = {
        ...cardData,
        isReversed: isReversed
    };
    
    const currentSlotIndex = currentMode - cardsToDraw;
    drawnCards.push(cardObj);
    
    cardsToDraw--;
    updateDrawCount();
    
    // Create animated card in slot
    const slot = document.getElementById(`slot-${currentSlotIndex}`);
    slot.innerHTML = ''; // Clear slot text
    
    const safeTitle = getSafeImageFilename(cardObj.title);
    const imgSrc = `data/${safeTitle}.jpg`;
    
    const cardHtml = `
        <div class="spread-card">
            <div class="spread-card-inner">
                <div class="spread-card-front">
                    <img src="${imgSrc}" alt="${cardObj.title}" onerror="this.src='data/The Fool.jpg'">
                </div>
                <div class="spread-card-back"></div>
            </div>
        </div>
    `;
    
    slot.innerHTML = cardHtml;
    
    const spreadCard = slot.querySelector('.spread-card');
    
    // Flip animation
    setTimeout(() => {
        spreadCard.classList.add('flipped');
        if (isReversed) {
            spreadCard.classList.add('reversed');
        }
    }, 300);

    // If done drawing
    if (cardsToDraw === 0) {
        document.getElementById('shuffle-btn').classList.add('hidden');
        document.getElementById('instruction').innerHTML = "Đã chọn xong. Hãy xem giải mã!";
        setTimeout(() => {
            document.getElementById('reveal-btn').classList.remove('hidden');
        }, 1000);
    }
}

function revealCards() {
    document.getElementById('draw-interface').classList.add('hidden');
    const resultInterface = document.getElementById('result-interface');
    resultInterface.classList.remove('hidden');
    
    const readingCardsContainer = document.getElementById('reading-cards');
    readingCardsContainer.innerHTML = '';
    
    const meaningsDb = BOITAROT_DATA.meanings;
    
    drawnCards.forEach((card, index) => {
        const positionTitle = modeTitles[currentMode][index] || 'Lá Bài';
        const statusText = card.isReversed ? "Ngược" : "Xuôi";
        const statusClass = card.isReversed ? "reversed" : "upright";
        const directionKey = card.isReversed ? 'reversed' : 'upright';
        
        let meaningText = "Ý nghĩa đang được cập nhật...";
        
        // Fetch specific meaning
        try {
            if (meaningsDb[currentQuestionId] && meaningsDb[currentQuestionId][card.id]) {
                const specData = meaningsDb[currentQuestionId][card.id][directionKey];
                if (specData && specData.length > 0) {
                    meaningText = specData.map(m => stripHtml(m.content)).join('<br><br>');
                }
            } else {
                // fallback to general topic if specific question not found (rare)
                // we'll just try topic ID 30 or something, but usually it exists.
                const generalTopic = BOITAROT_DATA.topics[0].children[0].id;
                if (meaningsDb[generalTopic] && meaningsDb[generalTopic][card.id]) {
                    const fallbackData = meaningsDb[generalTopic][card.id][directionKey];
                    if (fallbackData && fallbackData.length > 0) {
                        meaningText = fallbackData.map(m => stripHtml(m.content)).join('<br><br>');
                    }
                }
            }
        } catch(e) {
            console.error(e);
        }
        
        const safeTitle = getSafeImageFilename(card.title);
        const imgSrc = `data/${safeTitle}.jpg`;
        
        // Map slug to Vietnamese name if available
        // Create an array mapping from your old y-nghia-tarot.js if we want, or just use English
        // We'll just use English title since it's already beautiful.
        
        const cardHtml = `
            <div class="result-card" style="animation-delay: ${index * 0.3}s">
                <div class="result-card-img-wrapper ${card.isReversed ? 'reversed' : ''}">
                    <img src="${imgSrc}" alt="${card.title}" onerror="this.src='data/The Fool.jpg'">
                </div>
                <div class="result-content">
                    <div class="position-title">${positionTitle}</div>
                    <h3 class="card-title">${card.title}</h3>
                    <div class="meaning-label ${statusClass}">Trạng thái: ${statusText}</div>
                    <div class="card-desc">
                        ${meaningText}
                    </div>
                </div>
            </div>
        `;
        readingCardsContainer.innerHTML += cardHtml;
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetApp() {
    document.getElementById('draw-interface').classList.add('hidden');
    document.getElementById('result-interface').classList.add('hidden');
    document.getElementById('setup-interface').classList.remove('hidden');
    document.getElementById('shuffle-btn').classList.remove('hidden');
    document.getElementById('instruction').innerHTML = 'Hãy xáo bài và chọn <span id="cards-to-draw">0</span> lá bài mà bạn cảm thấy kết nối nhất.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Initialize
window.onload = initApp;
