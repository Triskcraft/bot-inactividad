# Sistema de posts (blog)

## Propósito

Este módulo convierte Discord en un flujo editorial simple:

- creación de borradores,
- edición en hilo,
- publicación controlada,
- detección de desactualización.

## Componentes clave

- **`src/services/blog.service.ts`**: orquestador principal.
- **`src/classes/post.ts`**: entidad de publicación y transiciones de estado.
- **`src/classes/posts-manager.ts`**: cache y acceso a posts.
- **Interacciones `blog/*`**: botones/modales para crear y cambiar estado.

## Estado de un post

`POST_STATUS`:

- `DRAFT`: borrador en edición.
- `PUBLISHED`: versión vigente publicada.
- `OUTDATED`: quedó obsoleta tras nueva edición.

## Flujo operativo

## 1) Inicialización

`blogService.start()` valida:

- rol permitido para publicar (`BLOG_ROLE_ID`),
- canal del blog (`BLOG_CHANNEL_ID`),
- panel pineado de control.

## 2) Crear borrador

1. Usuario autorizado usa botón del panel.
2. Ingresa título en modal.
3. El bot crea un mensaje de cabecera + thread.
4. Se registra el post en BD (`DRAFT`).

## 3) Publicar

1. El servicio recoge mensajes del autor en el hilo.
2. Reescribe `post_blocks` con el contenido actual.
3. Cambia estado a `PUBLISHED`.
4. Actualiza tarjeta de estado en el mensaje principal.

## 4) Desactualizar automáticamente

Si un post `PUBLISHED` recibe mensajes o ediciones nuevas del autor en su thread, se marca `OUTDATED`.

**Por qué existe:** evita que una publicación marcada como vigente quede incoherente con cambios posteriores.

## Qué guarda la base de datos

- Metadatos del post (`title`, `thread_id`, autor, estado).
- Bloques (`post_blocks`) con contenido serializado, embeds y componentes.

**Para qué sirve este almacenamiento por bloques:** reconstruir o exportar publicaciones en el futuro sin depender del historial parcial de Discord.
