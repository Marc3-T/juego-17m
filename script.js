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
const ANCHO_REF = 375;

let pajaro = {
    x: 0,
    y: 0,
    vy: 0,
    radio: 15,
    gravedad: 0.6,
    salto: -5.5
};

let obstaculos = [];
const VELOCIDAD_BASE = 3.5;
const ESPACIO_VERTICAL = 210;
const DISTANCIA_HORIZONTAL = 250;

let puntuacion = 0;
let jugando = false;
let animacionId = null;

// ===================== FUNCIONES DE DIBUJO =====================
function dibujarCorazon(x, y, radio, rotacion = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotacion);
    ctx.fillStyle = '#e63946';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    const s = radio / 15;
    ctx.moveTo(0, -5 * s);
    ctx.bezierCurveTo(-5 * s, -15 * s, -15 * s, -10 * s, 0, 5 * s);
    ctx.bezierCurveTo(15 * s, -10 * s, 5 * s, -15 * s, 0, -5 * s);
    ctx.fill();
    ctx.restore();
}

function dibujarColumna(x, y, ancho, alto) {
    const radio = 10 * escala;
    ctx.fillStyle = '#ff8da1';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 8;
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
    ctx.shadowBlur = 0;
}

// ===================== LÓGICA DE JUEGO =====================
function reiniciarValores() {
    pajaro.y = alto / 2;
    pajaro.vy = 0;
    obstaculos = [];
    puntuacion = 0;
}

function crearObstaculo() {
    const anchoColumna = 45 * escala;
    const espacio = ESPACIO_VERTICAL * escala;
    const centroY = Math.random() * (alto - espacio - 80 * escala) + 40 * escala;
    obstaculos.push({
        x: ancho,
        sup: { y: 0, alto: centroY - espacio/2 },
        inf: { y: centroY + espacio/2, alto: alto - (centroY + espacio/2) },
        ancho: anchoColumna,
        pasada: false
    });
}

function actualizar() {
    pajaro.vy += pajaro.gravedad * escala;
    pajaro.y += pajaro.vy;
    
    if (pajaro.y + pajaro.radio * escala > alto) {
        pajaro.y = alto - pajaro.radio * escala;
        gameOver();
        return;
    }
    if (pajaro.y - pajaro.radio * escala < 0) {
        pajaro.y = pajaro.radio * escala;
        pajaro.vy = 0;
    }
    
    for (let i = obstaculos.length - 1; i >= 0; i--) {
        const obs = obstaculos[i];
        obs.x -= VELOCIDAD_BASE * escala;
        
        if (obs.x + obs.ancho < 0) {
            obstaculos.splice(i, 1);
            continue;
        }
        
        if (!obs.pasada && obs.x + obs.ancho < pajaro.x) {
            obs.pasada = true;
            puntuacion++;
            if (puntuacion >= 17) {
                ganarJuego();
                return;
            }
        }
        
        if (hayColision(obs)) {
            gameOver();
            return;
        }
    }
    
    if (obstaculos.length === 0 || obstaculos[obstaculos.length-1].x < ancho - DISTANCIA_HORIZONTAL * escala) {
        crearObstaculo();
    }
}

function hayColision(obs) {
    const pjarox = pajaro.x;
    const pjaroy = pajaro.y;
    const radio = pajaro.radio * escala * 0.75;
    if (pjarox + radio > obs.x && pjarox - radio < obs.x + obs.ancho) {
        if (pjaroy - radio < obs.sup.alto) return true;
        if (pjaroy + radio > alto - obs.inf.alto) return true;
    }
    return false;
}

function dibujarTodo() {
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(i * 100 * escala + 30 * escala, 50 * escala, 25 * escala, 0, Math.PI*2);
        ctx.arc(i * 100 * escala + 60 * escala, 40 * escala, 20 * escala, 0, Math.PI*2);
        ctx.fill();
    }
    obstaculos.forEach(obs => {
        dibujarColumna(obs.x, 0, obs.ancho, obs.sup.alto);
        dibujarColumna(obs.x, alto - obs.inf.alto, obs.ancho, obs.inf.alto);
    });
    const rotacion = Math.min(Math.max(pajaro.vy * 0.1, -0.5), 0.5);
    dibujarCorazon(pajaro.x, pajaro.y, pajaro.radio * escala, rotacion);
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
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    saltar();
});
canvas.addEventListener('mousedown', saltar);
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
    canvas.classList.add('oculto');
    perdiste.classList.remove('oculto');
}

function ganarJuego() {
    jugando = false;
    cancelAnimationFrame(animacionId);
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
    });
    canvas.classList.add('oculto');
    ganaste.classList.remove('oculto');
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
    pajaro.radio = 15;
}

window.addEventListener('resize', () => {
    if (jugando) redimensionarCanvas();
});

redimensionarCanvas();
