# Simulador Electromecánica — Ley de Coulomb

Simulador web interactivo de electrostática desarrollado con Django y Canvas API.

---

## Alcance

### Física implementada
- **Ley de Coulomb** `F = k·q₁q₂/r²` entre múltiples cargas puntuales
- **Superposición de fuerzas** — fuerza resultante vectorial sobre cada carga
- **Clasificación** automática de atracción (cargas opuestas) y repulsión (cargas iguales)
- **Geometría vectorial** — componentes Δx, Δy, distancia `r` y ángulo θ desde q1

### Visualización en canvas
- Cuadrícula adaptativa con etiquetas en metros
- Ejes cartesianos con origen en q1
- Proyecciones ortogonales (Δx en rojo, Δy en verde) con cuadro de ángulo recto
- Sector de ángulo con etiqueta en grados
- Flechas de fuerza resultante (escala logarítmica) en amarillo
- Líneas de conexión: rojo = repulsión, verde = atracción

### Interacción
- Arrastrar cargas con mouse o touch
- Pan de la vista arrastrando el fondo
- Zoom con scroll, pellizco (pinch) o botones `+` / `−`
- Teclas: `+` acercar, `-` alejar, `0` reset, `F` ajustar a todas las cargas

### Panel lateral
- Agregar cargas por valor, tipo (+/−) y posición
  - Modo **Centro**: posición automática en espiral
  - Modo **Coordenadas**: distancia y ángulo desde q1
- Edición en tiempo real de distancia y ángulo de cada carga
- Tabla de fuerzas entre todos los pares (distancia, ángulo, fuerza en N, tipo)

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 6.0.3 (Python 3.13) |
| Frontend | HTML5 + Canvas API + JavaScript vanilla |
| Servidor | Gunicorn + WhiteNoise |
| Base de datos | SQLite3 (sin uso activo) |
| Deploy | Docker (puerto 8111) |

---

## Estructura del proyecto

```
electromecanica_proyecto/
├── manage.py
├── requirements.txt
├── Dockerfile
├── mysite/              # Configuración Django
│   ├── settings.py
│   └── urls.py
├── puntos/              # Aplicación principal
│   └── views.py
└── templates/
    └── puntos/
        └── index.html   # SPA completa (HTML + CSS + JS)
```

---

## Ejecución local

```bash
pip install -r requirements.txt
python manage.py runserver
```

Abrir [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## Pendiente / Próximas funcionalidades

- [ ] Campo eléctrico `E = k·q/r²` con visualización de vectores en grilla
- [ ] Líneas de campo eléctrico (field lines)
- [ ] Potencial eléctrico `V = k·q/r` con mapa de color
- [ ] Separación en módulos JS para mejor mantenimiento
- [ ] Persistencia de sesión (localStorage)
