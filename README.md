# Protocolo

Instrumento audiovisual para la web. Ocho nodos quieren tempos distintos. El protocolo (K) los jala hacia una misma fase. Cuando coinciden, aparece un loop. Cuando se sueltan, la consola se desgarra.

El modelo es el Kuramoto clásico:

```
dθᵢ/dt = ωᵢ + (K / N) · Σ sin(θⱼ − θᵢ)
```

- **θ** es el momento del ciclo de cada nodo. De ahí salen el gesto y el sonido.
- **ω** es su tempo propio.
- **K** es cuánto se escuchan.
- **N** es 8.
- **r** es el orden del grupo: cerca de 0 desvío, en el medio acoplado, cerca de 1 cerrado.

## Probar en la web

https://cognitivearia.github.io/Kuramoto_exploration/

La primera vez hay que encender Pages en el repositorio: Settings, Pages, origen **GitHub Actions**. Después, cada push publica solo. Pulsa **Entrar**. El navegador solo deja sonar después de ese gesto.

## Cómo abrirlo en local

Hace falta Node.

```bash
npm install
npm run dev
```

Abre la dirección que muestra la terminal. Pulsa **Entrar**. El navegador solo deja sonar después de ese gesto.

## Cómo tocarlo

- Arrastra el vacío hacia arriba o abajo: sube o baja **K**.
- Arrastra un nodo en horizontal: lo dejas adelante o atrás. Ese desfase se oye varios pulsos y después el protocolo lo recoge. El tiempo está en `PHASE_HOLD`, en `src/kuramoto.js`.
- Arrastra un nodo en vertical: cambias su tempo.
- Flechas izquierda y derecha: **deriva**, qué tan distintos son los tempos de fábrica.
- Flechas arriba y abajo: también mueven K.
- Espacio: golpe de fase. Si hay un nodo elegido, solo a ese. Si no, a todos.
- Mayús + espacio: golpe a todos.
- Teclas 1 a 8: eligen nodo. Escape suelta la elección.
- R: fases nuevas, al azar.
- M: silencio.

## Las cuatro voces

Hay dos nodos de cada una.

| Voz | Imagen | Sonido |
| --- | --- | --- |
| Pulso | Una mira que gira con la fase y destella al cerrar el ciclo | Golpe corto de ruido |
| Arpegio | Una columna de ocho pasos | Una nota de una escala menor en cada paso. El segundo nodo armoniza |
| Aire | Un anillo que respira | Un pad. Se desafina según su distancia a la fase del grupo |
| Falla | Un sólido que se desplaza cuando no coincide | Ruido que crece con esa misma distancia |

El zumbido grave crece con el orden. La radio crece con el desorden. El reloj pequeño de arriba marca la fase media del grupo.

## Dónde cambiar cosas

- La fórmula, los tempos y los umbrales de estado: `src/kuramoto.js`
- Las notas, los filtros y los volúmenes: `src/audio.js`
- Las formas, el fósforo y la cámara: `src/scene.js`
- El vidrio, el grano y el desgarro: `src/crt.js`

La deriva en 0 pone a todos el mismo tempo. La deriva en 1 usa los tempos escritos en `SPEC`.
