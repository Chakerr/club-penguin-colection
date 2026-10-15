# Iglú de Colección

Catálogo y tracker personal del merch oficial de Club Penguin (2008–2013): peluches, puffles, figuras Mix 'N Match, cartas Card-Jitsu, pines, libros, revistas, tarjetas de membresía, videojuegos y más. 550 artículos con rareza estimada, descripción, guía para saber si es original y enlaces a ventas reales en eBay.

Es una app web instalable (PWA): funciona sin conexión una vez abierta y se puede agregar a la pantalla de inicio del celular.

## Uso

- **Buscar:** por nombre, serie (`series 7` o `s7`), categoría o color en español (`puffle rosa`). La tecla `/` enfoca el buscador.
- **Marcar:** el círculo ✓ de cada tarjeta. Las cartas Card-Jitsu y las revistas en español/portugués llevan contador.
- **Ficha:** toca una tarjeta. Trae foto, descripción, otras versiones del mismo traje, precio pagado, fecha, notas y tu propia foto.
- **Respaldo:** menú ⋯ → Exportar / Importar. El progreso vive en el navegador de cada dispositivo; el archivo `.json` sirve para pasarlo entre el celular y el PC. Importar combina, no borra.

## Fotos propias

Hay dos formas:

1. **Desde la app** (ficha → Agregar foto). Se guarda solo en ese dispositivo y no entra en el respaldo.
2. **En el repo**, para verlas en todos lados: guarda la imagen en `fotos/` y agrega una línea en `data/mis-fotos.json` con el `id` del artículo:

   ```json
   {
     "plush-series-1-rockhopper": "fotos/rockhopper-s1.jpg"
   }
   ```

   El `id` aparece en la URL al abrir la ficha (`#/item/<id>`).

## Datos

- `data/catalog.json` es el catálogo completo. Cada artículo tiene `id`, `cat`, `group`, `name`, `rarity` (`c` común, `p` poco común, `r` raro, `m` muy raro, `x` inconseguible), `desc` y, si la hay, `img`.
- No cambies los `id` de artículos existentes: el progreso guardado depende de ellos.
- Las listas de Mix 'N Match series 6, 9 y 11 y los llaveros de puffle están incompletas en las fuentes.

## Publicar en GitHub Pages

Settings → Pages → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.

## Créditos

Las fotos del catálogo se muestran enlazadas desde [That Penguin Game](https://thatpenguingame.com/club-penguin-toys/) y siguen siendo de sus autores; no se copian a este repo. Listas cruzadas con el [Club Penguin Wiki](https://clubpenguin.fandom.com/) y fichas de ToyWiz.

Club Penguin es una marca de Disney. Proyecto de fans, sin fines comerciales.
