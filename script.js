// --- Конфигурация ---
const CONFIG = {
    GRID_SIZE: 20,
    INITIAL_SPEED: 200,
    MIN_SPEED: 60,
    SPEED_DECREMENT_PER_LEVEL: 15,
    FOOD_PER_LEVEL: 15,
    SNAKE_COLORS: ['red', 'blue', 'green', 'orange'],
    PLAYER_SNAKE_INDEX: 0,
    INTERPOLATION_STEPS: 5,
    // Настройки для нового управления
    PLAYER_STEER_STRENGTH: 0.7, // Насколько сильно игрок влияет на направление (0-1)
};

// --- Глобальные переменные ---
let canvas, ctx;
let snakes = [];
let food = null;
let gameInterval;
let lastRenderTime = 0;
let gameOver = false;
let scores = [0, 0, 0, 0];
let gameSpeed = CONFIG.INITIAL_SPEED;
let totalFoodEaten = 0;
let currentLevel = 1;
let aliveSnakes = 4;

let gridWidth, gridHeight;
let interpolationStep = 0;

// --- Для нового управления ---
let isDragging = false;
let dragX = 0;
let dragY = 0;

// --- Для консоли ---
let consoleLogs = [];
let consoleOpen = false;

// --- Класс Змея ---
class Snake {
    constructor(color, startX, startY, initialDirection) {
        this.color = color;
        this.body = [
            { x: startX, y: startY },
            { x: startX - (initialDirection === 'RIGHT' ? 1 : (initialDirection === 'LEFT' ? -1 : 0)), 
              y: startY - (initialDirection === 'DOWN' ? 1 : (initialDirection === 'UP' ? -1 : 0)) },
            { x: startX - 2 * (initialDirection === 'RIGHT' ? 1 : (initialDirection === 'LEFT' ? -1 : 0)), 
              y: startY - 2 * (initialDirection === 'DOWN' ? 1 : (initialDirection === 'UP' ? -1 : 0)) }
        ];
        this.direction = initialDirection;
        this.newDirection = initialDirection;
        // false означает, что AI управляет змеей по умолчанию
        // true будет означать, что игрок начал управлять этой змеей
        this.playerControlled = false; 
        this.grow = false;
        this.alive = true;
        this.visualHead = { x: startX, y: startY };
        this.nextHead = { x: startX, y: startY };
    }

    setDirection(newDir) {
        if (!this.alive) return;
        if (
            (this.direction === 'UP' && newDir !== 'DOWN') ||
            (this.direction === 'DOWN' && newDir !== 'UP') ||
            (this.direction === 'LEFT' && newDir !== 'RIGHT') ||
            (this.direction === 'RIGHT' && newDir !== 'LEFT')
        ) {
            this.newDirection = newDir;
        }
    }

     // Новая функция для установки направления с учетом силы влияния
     setDirectionTowards(targetX, targetY, canvasWidth, canvasHeight) {
        if (!this.alive) return;
        
        const head = this.body[0];
        // Преобразуем координаты пикселей в координаты сетки
        const targetGridX = Math.floor((targetX / canvasWidth) * gridWidth);
        const targetGridY = Math.floor((targetY / canvasHeight) * gridHeight);
        
        // Определяем желаемое направление движения
        const dx = targetGridX - head.x;
        const dy = targetGridY - head.y;
        
        // Если мы уже находимся в целевой клетке или очень близко, не меняем направление
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
            return;
        }
        
        let preferredDir = null;
        
        // Определяем приоритетное направление
        if (Math.abs(dx) > Math.abs(dy)) {
            // Движение по горизонтали имеет приоритет
            preferredDir = dx > 0 ? 'RIGHT' : 'LEFT';
        } else {
            // Движение по вертикали имеет приоритет
            preferredDir = dy > 0 ? 'DOWN' : 'UP';
        }
        
        // Проверяем, не является ли новое направление запрещенным (180 градусов)
        const isOpposite = (
            (this.direction === 'UP' && preferredDir === 'DOWN') ||
            (this.direction === 'DOWN' && preferredDir === 'UP') ||
            (this.direction === 'LEFT' && preferredDir === 'RIGHT') ||
            (this.direction === 'RIGHT' && preferredDir === 'LEFT')
        );
        
        // Если направление не противоположное, устанавливаем его
        if (!isOpposite) {
            this.newDirection = preferredDir;
        }
        // Если противоположное, мы не меняем направление, змея продолжит движение
        // Можно добавить логику для выбора одного из двух оставшихся направлений,
        // но для простоты оставим текущее.
    }

    move() {
        if (!this.alive) return;
        this.direction = this.newDirection;

        const head = { ...this.body[0] };

        switch (this.direction) {
            case 'UP': head.y--; break;
            case 'DOWN': head.y++; break;
            case 'LEFT': head.x--; break;
            case 'RIGHT': head.x++; break;
        }

        if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) {
            this.log(`Змея ${this.color} врезалась в стену!`);
            this.die();
            return;
        }

        this.visualHead = { ...this.body[0] };
        this.nextHead = { ...head };

        this.body.unshift(head);

        if (!this.grow) {
            this.body.pop();
        } else {
            this.grow = false;
        }
    }

    autoMoveLogic(currentFood) {
        if (!currentFood || !this.alive) return;

        const head = this.body[0];

        const occupiedPositions = new Set();
        snakes.forEach(snake => {
            if (snake && snake.alive) {
                snake.body.forEach(segment => {
                    occupiedPositions.add(`${segment.x},${segment.y}`);
                });
            }
        });

        const possibleDirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const validDirs = possibleDirs.filter(dir => {
             return !(
                (this.direction === 'UP' && dir === 'DOWN') ||
                (this.direction === 'DOWN' && dir === 'UP') ||
                (this.direction === 'LEFT' && dir === 'RIGHT') ||
                (this.direction === 'RIGHT' && dir === 'LEFT')
            );
        });

        if (validDirs.length === 0) return;

        const safeDirs = validDirs.filter(dir => {
            let nextX = head.x, nextY = head.y;
            switch(dir) {
                case 'UP': nextY--; break;
                case 'DOWN': nextY++; break;
                case 'LEFT': nextX--; break;
                case 'RIGHT': nextX++; break;
            }
            if (nextX < 0 || nextX >= gridWidth || nextY < 0 || nextY >= gridHeight) {
                return false;
            }
            if (occupiedPositions.has(`${nextX},${nextY}`)) {
                return false;
            }
            return true;
        });

        let chosenDir = null;
        if (safeDirs.length > 0) {
            let bestDist = Infinity;
            safeDirs.forEach(dir => {
                let nextX = head.x, nextY = head.y;
                switch(dir) {
                    case 'UP': nextY--; break;
                    case 'DOWN': nextY++; break;
                    case 'LEFT': nextX--; break;
                    case 'RIGHT': nextX++; break;
                }
                const dist = Math.abs(nextX - currentFood.x) + Math.abs(nextY - currentFood.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    chosenDir = dir;
                }
            });
        } else {
            this.log(`Змея ${this.color} в ловушке, делает отчаянный шаг.`);
            chosenDir = validDirs[0];
        }

        if (chosenDir) {
            this.setDirection(chosenDir);
        }
    }
    
    die() {
        if (!this.alive) return;
        this.alive = false;
        aliveSnakes--;
        this.log(`Выбыла из игры. Осталось: ${aliveSnakes}`);
        updateScoreBoard();
        
        if (aliveSnakes <= 1) {
            endGame();
        }
    }
    
    // Метод для логирования с указанием цвета змеи
    log(message) {
        addToConsole(`[${this.color.toUpperCase()}] ${message}`);
    }
}

// --- Инициализация игры ---
function initGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    resetGame();
    
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', (e) => {
            e.stopPropagation();
            resetGame();
        });
    }
    
    // Инициализация консоли
    initConsole();
    
    // Добавляем обработчики событий для нового управления
    if (canvas) {
        // Мыши
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp); // На случай, если мышь вышла за пределы canvas
        
        // Сенсорные экраны
        canvas.addEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchend', handleTouchEnd);
    }

    requestAnimationFrame(gameLoop);
}

// --- Адаптивный размер canvas ---
function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (!container) return;
    
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    const rect = canvas.getBoundingClientRect();
    gridWidth = Math.floor(rect.width / CONFIG.GRID_SIZE);
    gridHeight = Math.floor(rect.height / CONFIG.GRID_SIZE);
    
    addToConsole(`Canvas размер: ${canvas.width}x${canvas.height}, Сетка: ${gridWidth}x${gridHeight}`);
}

// --- Обработчики событий мыши ---
function handleMouseDown(event) {
    if (gameOver) return;
    
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    dragX = event.clientX - rect.left;
    dragY = event.clientY - rect.top;
    
    startPlayerControl(dragX, dragY);
    event.preventDefault(); // Предотвращаем выделение текста
}

function handleMouseMove(event) {
    if (gameOver || !isDragging) return;
    
    const rect = canvas.getBoundingClientRect();
    dragX = event.clientX - rect.left;
    dragY = event.clientY - rect.top;
    
    updatePlayerDirection(dragX, dragY);
    event.preventDefault();
}

function handleMouseUp(event) {
    if (gameOver) return;
    
    isDragging = false;
    stopPlayerControl();
    event.preventDefault();
}

// --- Обработчики событий касания ---
function handleTouchStart(event) {
    if (gameOver) return;
    
    event.preventDefault(); // Предотвращаем масштабирование и прокрутку
    
    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    dragX = touch.clientX - rect.left;
    dragY = touch.clientY - rect.top;
    
    startPlayerControl(dragX, dragY);
}

function handleTouchMove(event) {
    if (gameOver || !isDragging) return;
    
    event.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    dragX = touch.clientX - rect.left;
    dragY = touch.clientY - rect.top;
    
    updatePlayerDirection(dragX, dragY);
}

function handleTouchEnd(event) {
    if (gameOver) return;
    
    isDragging = false;
    stopPlayerControl();
    event.preventDefault();
}

// --- Логика управления игроком ---
function startPlayerControl(x, y) {
    const playerSnake = snakes[CONFIG.PLAYER_SNAKE_INDEX];
    if (!playerSnake || !playerSnake.alive) return;

    playerSnake.playerControlled = true;
    updatePlayerStatus('красной (управление)');
    addToConsole("Игрок начал управление красной змеей");
    updatePlayerDirection(x, y);
}

function updatePlayerDirection(x, y) {
    const playerSnake = snakes[CONFIG.PLAYER_SNAKE_INDEX];
    if (!playerSnake || !playerSnake.alive || !playerSnake.playerControlled) return;

    // Используем новую функцию для установки направления
    playerSnake.setDirectionTowards(x, y, canvas.width, canvas.height);
}

function stopPlayerControl() {
    const playerSnake = snakes[CONFIG.PLAYER_SNAKE_INDEX];
    if (!playerSnake || !playerSnake.alive) return;

    playerSnake.playerControlled = false;
    updatePlayerStatus('красной (AI)');
    addToConsole("Управление красной змеей возвращено AI");
}

// --- Сброс игры ---
function resetGame() {
    gameOver = false;
    scores = [0, 0, 0, 0];
    gameSpeed = CONFIG.INITIAL_SPEED;
    totalFoodEaten = 0;
    currentLevel = 1;
    aliveSnakes = CONFIG.SNAKE_COLORS.length;
    interpolationStep = 0;
    
    // Сброс состояния управления
    isDragging = false;

    snakes = [
        new Snake(CONFIG.SNAKE_COLORS[0], 5, 5, 'RIGHT'),
        new Snake(CONFIG.SNAKE_COLORS[1], Math.max(5, gridWidth - 6), 5, 'LEFT'),
        new Snake(CONFIG.SNAKE_COLORS[2], 5, Math.max(5, gridHeight - 6), 'RIGHT'),
        new Snake(CONFIG.SNAKE_COLORS[3], Math.max(5, gridWidth - 6), Math.max(5, gridHeight - 6), 'LEFT')
    ];

    food = null;
    generateFood();

    // Красная змея по умолчанию управляется AI
    snakes[CONFIG.PLAYER_SNAKE_INDEX].playerControlled = false;
    updatePlayerStatus('красной (AI)');
    
    clearToasts();
    clearConsole(); // Очищаем лог консоли при перезапуске
    
    updateScoreBoard();
    updateLevelDisplay();

    addToConsole("Игра перезапущена");
}

// --- Обновление статуса игрока в инструкции ---
function updatePlayerStatus(status) {
    const playerHighlight = document.querySelector('.instructions .player-highlight');
    if (playerHighlight) {
        playerHighlight.textContent = status;
    }
}

// --- Функция для показа всплывающих уведомлений ---
function showToast(message, duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, duration + 500);
}

// --- Функция для очистки всех уведомлений ---
function clearToasts() {
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.innerHTML = '';
    }
}

// --- Конец игры ---
function endGame() {
    gameOver = true;
    const winner = snakes.find(s => s && s.alive);
    const winnerName = winner ? 
        (winner.color === 'red' ? 'Красная (Вы)' : 
        winner.color === 'blue' ? 'Синяя' : 
        winner.color === 'green' ? 'Зеленая' : 'Оранжевая') : 'Никто';
    
    const message = `Игра окончена! Победила змея ${winnerName}!`;
    showToast(message, 5000);
    addToConsole(message);
}

// --- Генерация еды ---
function generateFood() {
    if (gameOver || gridWidth === undefined || gridHeight === undefined) return;
    
    const occupiedPositions = new Set();
    snakes.forEach(snake => {
        if (snake && snake.alive) {
            snake.body.forEach(segment => {
                occupiedPositions.add(`${segment.x},${segment.y}`);
            });
        }
    });

    let newFood;
    let attempts = 0;
    do {
        newFood = {
            x: Math.floor(Math.random() * gridWidth),
            y: Math.floor(Math.random() * gridHeight)
        };
        attempts++;
        if (attempts > 1000) break;
    } while (occupiedPositions.has(`${newFood.x},${newFood.y}`));

    if (attempts <= 1000) {
        food = newFood;
    } else {
        food = { x: Math.floor(gridWidth / 2), y: Math.floor(gridHeight / 2) };
        addToConsole("Не удалось найти свободное место для еды, помещаю в центр");
    }
}

// --- Отрисовка ---
function draw() {
    if (!ctx || gridWidth === undefined || gridHeight === undefined) return;
    
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cellWidth = canvas.width / gridWidth;
    const cellHeight = canvas.height / gridHeight;

    if (food) {
        ctx.fillStyle = '#ff3333';
        const pulseSize = 0.5 + 0.2 * Math.sin(Date.now() / 200);
        const foodSize = Math.min(cellWidth, cellHeight) * pulseSize;
        ctx.fillRect(
            food.x * cellWidth + (cellWidth - foodSize) / 2,
            food.y * cellHeight + (cellHeight - foodSize) / 2,
            foodSize,
            foodSize
        );
    }

    snakes.forEach((snake, index) => {
        if (!snake || !snake.alive) return;
        
        let interpHeadX, interpHeadY;
        if (interpolationStep > 0 && interpolationStep <= CONFIG.INTERPOLATION_STEPS) {
            const t = interpolationStep / CONFIG.INTERPOLATION_STEPS;
            interpHeadX = snake.visualHead.x + (snake.nextHead.x - snake.visualHead.x) * t;
            interpHeadY = snake.visualHead.y + (snake.nextHead.y - snake.visualHead.y) * t;
        } else {
            interpHeadX = snake.body[0].x;
            interpHeadY = snake.body[0].y;
        }

        snake.body.forEach((segment, i) => {
            let drawX, drawY;
            if (i === 0) {
                drawX = interpHeadX;
                drawY = interpHeadY;
                ctx.fillStyle = lightenColor(snake.color, -30);
            } else {
                drawX = segment.x;
                drawY = segment.y;
                ctx.fillStyle = snake.color;
            }
            
            ctx.fillRect(
                drawX * cellWidth,
                drawY * cellHeight,
                cellWidth,
                cellHeight
            );

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                drawX * cellWidth,
                drawY * cellHeight,
                cellWidth,
                cellHeight
            );
            
            if (i === 0) {
                ctx.fillStyle = 'white';
                const eyeSize = Math.min(cellWidth, cellHeight) * 0.2;
                let eyeOffsetX = 0, eyeOffsetY = 0;
                
                switch(snake.direction) {
                    case 'RIGHT': eyeOffsetX = cellWidth * 0.2; eyeOffsetY = -cellHeight * 0.2; break;
                    case 'LEFT': eyeOffsetX = -cellWidth * 0.2; eyeOffsetY = -cellHeight * 0.2; break;
                    case 'UP': eyeOffsetX = -cellWidth * 0.2; eyeOffsetY = -cellHeight * 0.2; break;
                    case 'DOWN': eyeOffsetX = -cellWidth * 0.2; eyeOffsetY = cellHeight * 0.2; break;
                }
                
                ctx.beginPath();
                ctx.arc(
                    (drawX + 0.3) * cellWidth + eyeOffsetX,
                    (drawY + 0.4) * cellHeight + eyeOffsetY,
                    eyeSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(
                    (drawX + 0.7) * cellWidth + eyeOffsetX,
                    (drawY + 0.4) * cellHeight + eyeOffsetY,
                    eyeSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                
                ctx.fillStyle = 'black';
                const pupilSize = eyeSize * 0.5;
                ctx.beginPath();
                ctx.arc(
                    (drawX + 0.3) * cellWidth + eyeOffsetX,
                    (drawY + 0.4) * cellHeight + eyeOffsetY,
                    pupilSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
                ctx.beginPath();
                ctx.arc(
                    (drawX + 0.7) * cellWidth + eyeOffsetX,
                    (drawY + 0.4) * cellHeight + eyeOffsetY,
                    pupilSize,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        });
    });
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function lightenColor(color, percent) {
    const colors = {
        'red': '#ff4d4d',
        'blue': '#4d79ff',
        'green': '#4dff4d',
        'orange': '#ffad33'
    };
    const darkColors = {
        'red': '#cc0000',
        'blue': '#0066cc',
        'green': '#009900',
        'orange': '#cc6600'
    };
    
    if (percent < 0) {
        return darkColors[color] || color;
    }
    return colors[color] || color;
}

// --- Обновление состояния игры ---
function update() {
    if (gameOver || !food) return;

    snakes.forEach((snake, index) => {
        if (!snake || !snake.alive) return;
        
        // --- Логика управления ---
        // Если это красная змея и ей управляет игрок (isDragging)
        if (index === CONFIG.PLAYER_SNAKE_INDEX && snake.playerControlled) {
            // Направление уже установлено в updatePlayerDirection через setDirectionTowards
            // Никаких дополнительных действий не требуется здесь
        } else {
            // Для всех остальных змей (включая красную, если AI управляет)
            snake.autoMoveLogic(food);
        }

        snake.move();
        
        if (!snake.alive) return;

        if (snake.body[0].x === food.x && snake.body[0].y === food.y) {
            snake.grow = true;
            scores[index]++;
            totalFoodEaten++;
            
            if (totalFoodEaten % CONFIG.FOOD_PER_LEVEL === 0) {
                currentLevel++;
                gameSpeed = Math.max(CONFIG.MIN_SPEED, gameSpeed - CONFIG.SPEED_DECREMENT_PER_LEVEL);
                addToConsole(`Уровень повышен до ${currentLevel}. Новая скорость: ${gameSpeed}ms`);
                showToast(`Уровень ${currentLevel}!`);
                updateLevelDisplay();
            }
            
            generateFood();
            updateScoreBoard(true);
        }

        for (let i = 1; i < snake.body.length; i++) {
            if (snake.body[0].x === snake.body[i].x && snake.body[0].y === snake.body[i].y) {
                snake.log(`врезалась в себя!`);
                snake.die();
                return;
            }
        }

        snakes.forEach((otherSnake, otherIndex) => {
             if (!otherSnake || !otherSnake.alive || index === otherIndex) return;
             
             otherSnake.body.forEach((segment, segmentIndex) => {
                 if (snake.body[0].x === segment.x && snake.body[0].y === segment.y) {
                     snake.log(`врезалась в змею ${otherIndex + 1} (${otherSnake.color})!`);
                     snake.die();
                 }
             });
        });
    });
}

// --- Игровой цикл ---
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    const secondsSinceLastRender = (currentTime - lastRenderTime) / 1000;
    
    if (secondsSinceLastRender < gameSpeed / 1000) return;

    lastRenderTime = currentTime;

    interpolationStep = (interpolationStep + 1) % (CONFIG.INTERPOLATION_STEPS + 1);

    update();
    draw();
}

// --- Функции для работы с консолью ---
function initConsole() {
    const modal = document.getElementById('console-modal');
    const btn = document.getElementById('console-toggle');
    const span = document.getElementById('console-close');

    if (btn) {
        btn.onclick = function() {
            consoleOpen = true;
            if (modal) modal.style.display = 'block';
        }
    }
    
    if (span) {
        span.onclick = function() {
            consoleOpen = false;
            if (modal) modal.style.display = 'none';
        }
    }

    // Закрытие при клике вне окна
    window.onclick = function(event) {
        if (event.target === modal) {
            consoleOpen = false;
            if (modal) modal.style.display = 'none';
        }
    }
    
    // Закрытие на клавишу Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && consoleOpen) {
            consoleOpen = false;
            if (modal) modal.style.display = 'none';
        }
    });
}

function addToConsole(message) {
    consoleLogs.push(`${new Date().toLocaleTimeString()} - ${message}`);
    
    const consoleLogElement = document.getElementById('console-log');
    if (consoleLogElement) {
        const logEntry = document.createElement('p');
        logEntry.textContent = consoleLogs[consoleLogs.length - 1];
        consoleLogElement.appendChild(logEntry);
        // Прокручиваем вниз
        consoleLogElement.scrollTop = consoleLogElement.scrollHeight;
    }
    
    // Ограничиваем количество логов в памяти
    if (consoleLogs.length > 100) {
        consoleLogs.shift();
    }
    
    // Также выводим в браузерную консоль
    console.log(message);
}

function clearConsole() {
    consoleLogs = [];
    const consoleLogElement = document.getElementById('console-log');
    if (consoleLogElement) {
        consoleLogElement.innerHTML = '';
    }
}

function updateScoreBoard(animate = false) {
    const scoreBoard = document.getElementById('score-board');
    if (!scoreBoard) return;
    scoreBoard.innerHTML = '';

    CONFIG.SNAKE_COLORS.forEach((color, index) => {
        const snake = snakes[index];
        if (!snake) return;
        
        const scoreItem = document.createElement('div');
        scoreItem.className = 'score-item';
        scoreItem.style.backgroundColor = lightenColor(color, 0);
        
        let status = '';
        if (!snake.alive) {
            status = ' (Выбыла)';
            scoreItem.classList.add('score-item--dead');
        } else if (index === CONFIG.PLAYER_SNAKE_INDEX && snake.playerControlled) {
            status = ' (Управление)';
        } else if (index === CONFIG.PLAYER_SNAKE_INDEX && !snake.playerControlled) {
            status = ' (AI)';
        }
        
        scoreItem.textContent = `${color === 'red' ? 'Красная (Вы)' : (color === 'blue' ? 'Синяя' : color === 'green' ? 'Зеленая' : 'Оранжевая')}: ${scores[index]}${status}`;
        
        if (animate && scores[index] > 0) {
            scoreItem.style.transform = 'scale(1.1)';
            setTimeout(() => {
                if (scoreItem) scoreItem.style.transform = 'scale(1)';
            }, 200);
        }
        
        scoreBoard.appendChild(scoreItem);
    });
}

function updateLevelDisplay() {
    const levelInfo = document.getElementById('level-info');
    if (levelInfo) {
        levelInfo.textContent = `Уровень: ${currentLevel}`;
        levelInfo.style.animation = 'none';
        setTimeout(() => {
            if (levelInfo) levelInfo.style.animation = 'pulse 2s infinite';
        }, 10);
    }
}

// --- Запуск ---
window.onload = initGame;