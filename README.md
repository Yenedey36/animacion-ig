# Bolera 3D Interactiva — Práctica de Animación (Three.js, Ammo.js y Tween.js)

**Autor:** Yenedey Morán Delgado  
**Asignatura:** Informática Gráfica
**CodeSandbox:** https://codesandbox.io/p/sandbox/ig-s11-forked-5h9z4f                     
**Vídeo de demostración:** https://drive.google.com/file/d/1v31-voZyWj0g_jsUS8P98Rz3pu0oECFP/view?usp=sharing


---

## 1. Descripción del proyecto

Este prototipo implementa una pista de bolos en 3D con estética nocturna de neón que combina simulación de física de cuerpos rígidos en tiempo real (**Ammo.js**) con animaciones por fotogramas clave (**Tween.js**).

El usuario puede ajustar la posición lateral, el ángulo de tiro, la potencia y el efecto (curva) de la bola antes de lanzarla contra una formación reglamentaria de 10 bolos. Al finalizar el lanzamiento, una secuencia mecánica animada limpia la pista y recoloca los bolos automáticamente. Además, se incluye un modo opcional con un obstáculo móvil que interactúa físicamente con la bola y una cámara dinámica que sigue la acción.

---

## 2. Implementación técnica

El proyecto toma como base la estructura del guion de la Semana 11 (`script_45_ammo.js` y `script_41_tween.js`), ampliándola en tres bloques principales:

### 2.1. Simulación física (`ammo.js`)
* **Mundo físico:** Configurado con `btDiscreteDynamicsWorld` y gravedad vertical (`-12.0`). En cada fotograma de `animationLoop()`, la función `updatePhysics(deltaTime)` avanza la simulación y sincroniza las posiciones y cuaterniones de los cuerpos rígidos con sus mallas de Three.js.
* **Cuerpos estáticos:** Pista principal de madera, canaletas laterales rebajadas, bordes exteriores y pared trasera con valores específicos de rozamiento y restitución (`createStaticBox`).
* **Cuerpos dinámicos:**
  * **Bolos:** 10 cuerpos cilíndricos (`btCylinderShape`) con amortiguación (`setDamping`) para un comportamiento realista al recibir impactos en cadena.
  * **Bolas:** Cuerpos esféricos (`btSphereShape`) lanzados con velocidad lineal y angular según los parámetros seleccionados. Si el usuario configura *Efecto*, se aplica una fuerza lateral continua (`applyCentralForce`) mientras la bola rueda por la pista para generar una trayectoria curva.
* **Cuerpos cinemáticos:** Tanto la barra barredora como el obstáculo móvil se configuran como cuerpos cinemáticos (activando el flag de colisión `2`). Esto permite moverlos mediante `Tween.js` sin que les afecte la gravedad, pero transfiriendo colisiones reales a las bolas y los bolos.
* **Detección de puntuación:** En cada paso se evalúa la orientación de cada bolo aplicando su cuaternión al vector vertical `(0, 1, 0)`; si su inclinación supera el umbral (`upVec.y < 0.72`) o cae al foso, se contabiliza como derribado.

### 2.2. Animaciones por fotogramas clave (`tween.js`)
* **Secuencia encadenada de reinicio (`.chain()`):** Al pulsar `R`, se encadenan tres tweens sobre la barra barredora: descenso (`Cubic.InOut`), barrido hacia el fondo (`Quadratic.InOut`) y retorno a reposo (`Cubic.Out`).
* **Colocación de bolos con rebote:** Tras retirarse la barra, los 10 bolos nuevos descienden con una interpolación `TWEEN.Easing.Bounce.Out` antes de instanciarse de nuevo en el mundo físico.
* **Obstáculo móvil en bucle:** Al activarlo desde la interfaz, emerge de la pista (`Back.Out`) y oscila lateralmente de forma continua con `Sinusoidal.InOut`, `.yoyo(true)` y `.repeat(Infinity)`.
* **Cámara dinámica:** Interpola suavemente tanto `camera.position` como `controls.target` (`Cubic.InOut`) para acercarse a la zona de bolos tras lanzar y volver a la vista de tiro al reiniciar. Si el usuario mueve la cámara manualmente con el ratón, el tween activo se detiene automáticamente para no interferir con `OrbitControls`.
* **Efecto visual de Strike:** Al derribar los 10 bolos, un tween hace parpadear la intensidad emisiva (`emissiveIntensity`) de los arcos de neón de la pista.

### 2.3. Escena, geometría y texturas procedurales
* **Geometría personalizada:** Los bolos se modelan mediante `THREE.LatheGeometry` a partir de un perfil 2D de 10 puntos de control.
* **Texturas en Canvas 2D:** Para evitar dependencias externas, la pista de madera (tablones, línea de falta y flechas guía), las franjas de los bolos y el patrón con agujeros de agarre de la bola se generan dinámicamente con `THREE.CanvasTexture`.
* **Iluminación y sombras:** Combinación de luz hemisférica, luz direccional con mapa de sombras suaves (`PCFSoftShadowMap`), foco cenital sobre los bolos y luces puntuales cian/magenta.

---

## 3. Controles e interacción

| Control | Acción |
| :--- | :--- |
| **`A` / `D`** o **`←` / `→`** | Desplazar la posición horizontal de la bola |
| **`Q` / `E`** | Ajustar el ángulo de lanzamiento |
| **`Espacio`** | Lanzar la bola |
| **`R`** | Activar secuencia de barrido y recolocación de bolos |
| **`V`** | Restablecer la cámara a la vista inicial |
| **Ratón (`OrbitControls`)** | Rotar, hacer zoom y desplazar la cámara libremente |
| **Panel superior derecho** | Ajustar potencia, efecto (curva), obstáculo móvil y cámara dinámica |

---

## 4. Estructura del proyecto

* `src/index.html`: Documento principal de entrada.
* `src/bolera.js` *(o nombre del script principal enlazado)*: Código fuente completo de la escena, físicas, animaciones e interfaz.
* `package.json`: Dependencias del proyecto (`three`, `ammojs-typed`, `@tweenjs/tween.js`, `lil-gui`).

---

## 5. Uso de herramientas de IA

Durante el desarrollo de esta práctica se ha utilizado IA como herramienta de apoyo para resolver dudas técnicas sobre el funcionamiento de las librerías empleadas, depurar algunos errores surgidos durante la implementación y estructurar la documentación del repositorio.

---

## 6. Fuentes y referencias

* **Guion y repositorio de la asignatura (IG - ULPGC, Semana 11):** Ejemplos base `script_41_tween.js` y `script_45_ammo.js`.
* **Three.js Documentation:** `LatheGeometry`, `OrbitControls`, `CanvasTexture` y sombras. https://threejs.org/docs/
* **Tween.js User Guide:** Encadenamiento de tweens y funciones de easing. https://github.com/tweenjs/tween.js/
* **Ammo.js (Bullet Physics port):** Gestión de cuerpos rígidos y cinemáticos. https://github.com/kripken/ammo.js/
* **Bibliografía del guion:** *Discover three.js*, *Learning Three.js* y *Three.js Cookbook* (Jos Dirksen).
