// --- Конфигурация ---
const CONFIG = {
    GRID_SIZE: 20,
    INITIAL_SPEED: 200,
    MIN_SPEED: 60,
    SPEED_DECREMENT_PER_LEVEL: 15,
    FOOD_PER_LEVEL: 15,
    AUTO_MOVE_DELAY: 2000,
    SNAKE_COLORS: ['red', 'blue', 'green', 'orange'],
    PLAYER_SNAKE_INDEX: 0,
    INTERPOLATION_STEPS: 5,
};

// --- Глобальные переменные ---
let canvas, ctx;
let snakes = [];
let food = null;
let gameInterval;
let lastRenderTime = 0;
let gameOver = false;
let scores = [0, 0, 0, 0];
let lastInputTime = 0;
let gameSpeed = CONFIG.INITIAL_SPEED;
let totalFoodEaten = 0;
let currentLevel = 1;
let aliveSnakes = 4;

let gridWidth, gridHeight;
let interpolationStep = 0;

// --- Класс Змея ---
class Snake {
    // ... (без изменений) ...
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
        this.autoMove = true;
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
            console.log(`Змея ${this.color} врезалась в стену!`);
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
        // ... (исправлено nextNextY) ...
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
            // Исправлена опечатка
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
            console.log(`Змея ${this.color} в ловушке, делает отчаянный шаг.`);
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
        console.log(`Змея ${this.color} выбыла из игры. Осталось: ${aliveSnakes}`);
        updateScoreBoard();
        
        if (aliveSnakes <= 1) {
            endGame();
        }
    }
}

// --- Инициализация игры ---
function initGame() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    resetGame();
    
    // Обработчик для новой кнопки перезапуска
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', resetGame);
    }
    
    window.addEventListener('keydown', handleKeyPress);
    setupMobileControls();

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
    
    console.log(`Canvas размер: ${canvas.width}x${canvas.height}, Сетка: ${gridWidth}x${gridHeight}`);
}

// --- Настройка мобильных элементов управления ---
function setupMobileControls() {
    const btnUp = document.getElementById('btn-up');
    const btnDown = document.getElementById('btn-down');
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');

    const addControl = (element, direction) => {
        if (element) {
            const pressHandler = (e) => {
                e.preventDefault();
                handleDirectionPress(direction);
            };
            element.addEventListener('touchstart', pressHandler);
            element.addEventListener('mousedown', pressHandler);
        }
    };

    addControl(btnUp, 'UP');
    addControl(btnDown, 'DOWN');
    addControl(btnLeft, 'LEFT');
    addControl(btnRight, 'RIGHT');
}

function handleDirectionPress(direction) {
    const playerSnake = snakes[CONFIG.PLAYER_SNAKE_INDEX];
    if (playerSnake && playerSnake.alive) {
        playerSnake.setDirection(direction);
        lastInputTime = Date.now();
    }
}

// --- Сброс игры ---
function resetGame() {
    gameOver = false;
    scores = [0, 0, 0, 0];
    lastInputTime = 0;
    gameSpeed = CONFIG.INITIAL_SPEED;
    totalFoodEaten = 0;
    currentLevel = 1;
    aliveSnakes = CONFIG.SNAKE_COLORS.length;
    interpolationStep = 0;

    snakes = [
        new Snake(CONFIG.SNAKE_COLORS[0], 5, 5, 'RIGHT'),
        new Snake(CONFIG.SNAKE_COLORS[1], Math.max(5, gridWidth - 6), 5, 'LEFT'),
        new Snake(CONFIG.SNAKE_COLORS[2], 5, Math.max(5, gridHeight - 6), 'RIGHT'),
        new Snake(CONFIG.SNAKE_COLORS[3], Math.max(5, gridWidth - 6), Math.max(5, gridHeight - 6), 'LEFT')
    ];

    food = null;
    generateFood();

    snakes[CONFIG.PLAYER_SNAKE_INDEX].autoMove = true;
    updatePlayerStatus('красной');
    // Очищаем все всплывающие уведомления при перезапуске
    clearToasts();
    
    updateScoreBoard();
    updateLevelDisplay();

    console.log("Игра перезапущена");
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

    // Удаляем тост после завершения анимации
    setTimeout(() => {
        toast.remove();
    }, duration + 500); // +500ms для завершения fade-out анимации
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
    showToast(message, 5000); // Показываем дольше
    console.log(message);
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
        console.warn("Не удалось найти свободное место для еды, помещаю в центр");
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

    const currentTime = Date.now();

    snakes.forEach((snake, index) => {
        if (!snake || !snake.alive) return;
        
        if (index === CONFIG.PLAYER_SNAKE_INDEX) {
            if (currentTime - lastInputTime > CONFIG.AUTO_MOVE_DELAY) {
                if (!snake.autoMove) {
                     snake.autoMove = true;
                     updatePlayerStatus('красной (авто)');
                }
            } else {
                if (snake.autoMove) {
                     snake.autoMove = false;
                     updatePlayerStatus('красной');
                }
            }

            if (snake.autoMove) {
                snake.autoMoveLogic(food);
            }
        } else {
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
                console.log(`Уровень повышен до ${currentLevel}. Новая скорость: ${gameSpeed}ms`);
                showToast(`Уровень ${currentLevel}!`); // Всплывающее уведомление
                updateLevelDisplay();
            }
            
            generateFood();
            updateScoreBoard(true);
        }

        for (let i = 1; i < snake.body.length; i++) {
            if (snake.body[0].x === snake.body[i].x && snake.body[0].y === snake.body[i].y) {
                console.log(`Змея ${index + 1} (${snake.color}) врезалась в себя!`);
                snake.die();
                return;
            }
        }

        snakes.forEach((otherSnake, otherIndex) => {
             if (!otherSnake || !otherSnake.alive || index === otherIndex) return;
             
             otherSnake.body.forEach((segment, segmentIndex) => {
                 if (snake.body[0].x === segment.x && snake.body[0].y === segment.y) {
                     console.log(`Змея ${index + 1} (${snake.color}) врезалась в змею ${otherIndex + 1} (${otherSnake.color})!`);
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

// --- Обработчики событий ---
function handleKeyPress(e) {
    if (gameOver) return;

    const playerSnake = snakes[CONFIG.PLAYER_SNAKE_INDEX];
    if (!playerSnake || !playerSnake.alive) return;

    lastInputTime = Date.now();

    switch (e.key) {
        case 'ArrowUp':
            playerSnake.setDirection('UP');
            e.preventDefault();
            break;
        case 'ArrowDown':
            playerSnake.setDirection('DOWN');
            e.preventDefault();
            break;
        case 'ArrowLeft':
            playerSnake.setDirection('LEFT');
            e.preventDefault();
            break;
        case 'ArrowRight':
            playerSnake.setDirection('RIGHT');
            e.preventDefault();
            break;
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
        } else if (index === CONFIG.PLAYER_SNAKE_INDEX && snake.autoMove) {
            status = ' (Авто)';
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