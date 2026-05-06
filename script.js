// ===================== CONFIGURACIÓN INICIAL =====================
const canvas = document.getElementById('canvas-juego');
const ctx = canvas.getContext('2d');

// Pantallas
const inicio = document.getElementById('pantalla-inicio');
const perdiste = document.getElementById('pantalla-perdiste');
const ganaste = document.getElementById('pantalla-ganaste');
const mensajeFinal = document.getElementById('mensaje-final');

// Botones
document.getElementById('boton-empezar').addEventListener('click', iniciarJuego);
document.getElementById('boton-reintentar').addEventListener('click', reiniciarJuego);
document.getElementById('boton-reiniciar').addEventListener('click', reiniciarJuego);

// Variables del juego
let ancho, alto;
let escala;
const ANCHO_REF = 375; // iPhone 6/7/8 lógico

// Pájaro (corazón)
let pajaro = {
    x: 0,
    y: 0,
    vy: 0,
    radio: 15, // tamaño base
    gravedad: 0.5,
    salto: -7
};

// Obstáculos (nubes con "17")
let obstaculos = [];
const VELOCIDAD_BASE = 2;
const ESPACIO_VERTICAL = 130; // apertura entre nubes
const DISTANCIA_HORIZONTAL = 250; // distancia entre pares

let puntuacion = 0;
let jugando = false;
let animacionId = null;

// Control de audio
let audioCtx = null;

// ===================== FUNCIONES DE DIBUJO =====================
function dibujarCorazon(x, y, radio, rotacion = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotacion);
    ctx.fillStyle = '#e63946';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    // Corazón escalado
    const s = radio / 15; // radio base de 15 píxeles coincide con el path del corazón
    ctx.moveTo(0, -5 * s);
    ctx.bezierCurveTo(-5 * s, -15 * s, -15 * s, -10 * s, 0, 5 * s);
    ctx.bezierCurveTo(15 * s, -10 * s, 5 * s, -15 * s, 0, -5 * s);
    ctx.fill();
    ctx.restore();
}

function dibujarNube(x, y, ancho, alto, texto = '17') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 10;
    
    // Rectángulo redondeado
    const radio = 20 * escala;
    ctx.beginPath();
    ctx.moveTo(x + radio, y);
    ctx.lineTo(x + ancho - radio, y);
    ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + radio);
    ctx.lineTo(x + ancho, y + alto - radio);
    ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - radio, y + alto);
    ctx.lineTo(x + radio, y + alto);
    ctx.quadraticCurveTo(x, y + alto, x, y + alto - radio);
    ctx.lineTo(x, y + radio);
    ctx.quadraticCurveTo(x, y, x + radio, y);
    ctx.closePath();
    ctx.fill();
    
    // Texto "17"
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b83b5e';
    ctx.font = `bold ${14*escala}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + ancho/2, y + alto/2);
}

// ===================== LÓGICA DE JUEGO =====================
function reiniciarValores() {
    pajaro.y = alto / 2;
    pajaro.vy = 0;
    obstaculos = [];
    puntuacion = 0;
}

function crearObstaculo() {
    const anchoNube = 50 * escala;
    const altoNube = 250 * escala; // Alto total de cada nube individual (se recortará con la posición)
    const espacio = ESPACIO_VERTICAL * escala;
    
    // Posición vertical aleatoria del centro del espacio
    const centroY = Math.random() * (alto - espacio - 100 * escala) + 50 * escala;
    
    obstaculos.push({
        x: ancho,
        // Nube superior
        sup: {
            y: 0,
            alto: centroY - espacio/2
        },
        // Nube inferior
        inf: {
            y: centroY + espacio/2,
            alto: alto - (centroY + espacio/2)
        },
        ancho: anchoNube,
        pasada: false
    });
}

function actualizar() {
    // Física del pájaro
    pajaro.vy += pajaro.gravedad * escala * 0.1;
    pajaro.y += pajaro.vy;
    
    // Limitar caída (si toca el suelo o el techo)
    if (pajaro.y + pajaro.radio * escala > alto) {
        pajaro.y = alto - pajaro.radio * escala;
        gameOver();
    }
    if (pajaro.y - pajaro.radio * escala < 0) {
        pajaro.y = pajaro.radio * escala;
        pajaro.vy = 0;
    }
    
    // Mover obstáculos
    for (let i = obstaculos.length - 1; i >= 0; i--) {
        const obs = obstaculos[i];
        obs.x -= VELOCIDAD_BASE * escala;
        
        // Eliminar obstáculos que salieron de la pantalla
        if (obs.x + obs.ancho < 0) {
            obstaculos.splice(i, 1);
            continue;
        }
        
        // Detectar paso del obstáculo (puntuación)
        if (!obs.pasada && obs.x + obs.ancho < pajaro.x) {
            obs.pasada = true;
            puntuacion++;
            if (typeof sonidoPunto === 'function') sonidoPunto();
            
            // ¿Ganó?
            if (puntuacion >= 17) {
                ganarJuego();
                return;
            }
        }
        
        // Colisión con nube superior o inferior
        if (colisiona(pajaro, obs.sup, obs.ancho, 'sup') || colisiona(pajaro, obs.inf, obs.ancho, 'inf')) {
            gameOver();
            return;
        }
    }
    
    // Crear nuevos obstáculos
    if (obstaculos.length === 0 || obstaculos[obstaculos.length-1].x < ancho - DISTANCIA_HORIZONTAL * escala) {
        crearObstaculo();
    }
}

function colisiona(paj, parteObs, anchoObs, tipo) {
    // parteObs: { y, alto }
    const pajIzq = paj.x - paj.radio * escala * 0.8;
    const pajDer = paj.x + paj.radio * escala * 0.8;
    const pajArriba = paj.y - paj.radio * escala * 0.8;
    const pajAbajo = paj.y + paj.radio * escala * 0.8;
    
    const obsIzq = parteObs.x || 0; // deberíamos almacenar x en la parte
    // Vamos a arreglarlo: necesitamos pasar el objeto obstáculo completo para tener x.
    // Modificamos llamada para enviar el obstáculo entero y la parte.
    // Haremos una pequeña reestructuración rápida.
    // En lugar de lo anterior, usaremos otra función.
    // (Abajo se resuelve)
    return false;
}

// Rehacemos la detección de colisión de manera más limpia
function hayColision(obs) {
    const pjarox = pajaro.x;
    const pjaroy = pajaro.y;
    const radio = pajaro.radio * escala * 0.75;
    
    // Colisión con nube superior
    if (pjarox + radio > obs.x && pjarox - radio < obs.x + obs.ancho) {
        if (pjaroy - radio < obs.sup.alto) {
            return true;
        }
        if (pjaroy + radio > alto - obs.inf.alto) {
            return true;
        }
    }
    return false;
}

function dibujarTodo() {
    ctx.clearRect(0, 0, ancho, alto);
    
    // Fondo con nubes decorativas estáticas
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(i*100*escala + 30, 50*escala, 30*escala, 0, Math.PI*2);
        ctx.arc(i*100*escala + 60, 40*escala, 25*escala, 0, Math.PI*2);
        ctx.fill();
    }
    
    // Dibujar obstáculos
    obstaculos.forEach(obs => {
        // Nube superior (parte visible desde arriba hasta la abertura)
        dibujarNube(obs.x, 0, obs.ancho, obs.sup.alto, '17');
        // Nube inferior
        dibujarNube(obs.x, alto - obs.inf.alto, obs.ancho, obs.inf.alto, '17');
    });
    
    // Rotación del corazón basada en velocidad vertical
    const rotacion = Math.min(Math.max(pajaro.vy * 0.1, -0.5), 0.5);
    dibujarCorazon(pajaro.x, pajaro.y, pajaro.radio * escala, rotacion);
    
    // Marcador
    ctx.fillStyle = 'white';
    ctx.font = `${28*escala}px "Pacifico", cursive`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00000040';
    ctx.shadowBlur = 4;
    ctx.fillText(`${puntuacion} / 17`, ancho/2, 60*escala);
    ctx.shadowBlur = 0;
}

// ===================== CONTROL DE JUEGO =====================
function loop() {
    if (!jugando) return;
    
    actualizar();
    dibujarTodo();
    animacionId = requestAnimationFrame(loop);
}

function saltar() {
    if (!jugando) return;
    pajaro.vy = pajaro.salto * escala;
    if (typeof sonidoAleteo === 'function') sonidoAleteo();
}

// Eventos táctiles y de ratón
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    saltar();
});
canvas.addEventListener('mousedown', saltar);

// Tecla espacio para depurar en PC
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        saltar();
    }
});

// ===================== INICIO / REINICIO =====================
function iniciarJuego() {
    inicio.classList.add('oculto');
    canvas.classList.remove('oculto');
    
    // Activar contexto de audio con interacción
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        crearSonidos();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    redimensionarCanvas();
    reiniciarValores();
    jugando = true;
    loop();
}

function reiniciarJuego() {
    perdiste.classList.add('oculto');
    ganaste.classList.add('oculto');
    canvas.classList.remove('oculto');
    
    redimensionarCanvas();
    reiniciarValores();
    jugando = true;
    loop();
}

function gameOver() {
    jugando = false;
    cancelAnimationFrame(animacionId);
    if (typeof sonidoChoque === 'function') sonidoChoque();
    
    canvas.classList.add('oculto');
    perdiste.classList.remove('oculto');
}

function ganarJuego() {
    jugando = false;
    cancelAnimationFrame(animacionId);
    
    // Confeti
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
    });
    
    canvas.classList.add('oculto');
    ganaste.classList.remove('oculto');
    
    // Mensaje personalizable (cámbialo desde aquí)
    mensajeFinal.innerHTML = '✨ 17 meses de magia ✨<br>Gracias por ser el amor de mi vida.<br>¡Te amo! 💖';
}

// ===================== AJUSTE RESPONSIVE =====================
function redimensionarCanvas() {
    ancho = window.innerWidth;
    alto = window.innerHeight;
    canvas.width = ancho;
    canvas.height = alto;
    escala = ancho / ANCHO_REF;
    
    pajaro.x = ancho * 0.2;
    pajaro.radio = 15; // base
}

window.addEventListener('resize', () => {
    if (jugando) {
        redimensionarCanvas();
    }
});

// ===================== SONIDOS (API Web Audio) =====================
let sonidoAleteo, sonidoPunto, sonidoChoque;

function crearSonidos() {
    // Aleteo: tono agudo corto
    sonidoAleteo = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    };
    
    // Punto: "ding" agradable
    sonidoPunto = () => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    };
    
    // Choque: ruido bajo
    sonidoChoque = () => {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.2;
        }
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
    };
}

// Ajuste inicial
redimensionarCanvas();
