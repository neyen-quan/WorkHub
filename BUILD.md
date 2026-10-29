# Compilación y entrega

`npm ci`, `npm test`, `npm run build`. `npm run package:win` requiere Windows x64 y las herramientas MSVC/Windows SDK (se preparan en Actions). Dependencias fijadas en package-lock.json.

Un commit a main con versión nueva en package.json y package-lock.json inicia la publicación. CI audita, prueba, compila Windows, descarga y valida el paquete exacto publicado anterior, y crea solo los archivos modificados del parche. Runtime y lanzador sin cambios reutilizan sus bytes publicados. Nunca recompilar un tag para crear una base aproximada.

La release se prepara como borrador. Se suben los assets, se vuelven a descargar por ID y se verifican tamaños, SHA-256 e inventarios antes de publicar. Los assets publicados son inmutables. Una versión ya publicada se verifica sin recompilar.

Recuperación: Actions → Publicar WorkHub → Run workflow desde main, indicando un tag existente. Se usan las herramientas actuales del pipeline con las fuentes de ese tag. No reejecutar un workflow defectuoso antiguo ni crear releases manuales.

La transición desde 0.7.2/0.7.3 se instala mediante el ZIP compatible con el botón Actualizar antiguo. Al reiniciar se abre el instalador independiente que prepara el lanzador estable y el motor verificado; reutiliza el runtime local si sus hashes coinciden. Si el runtime requerido es distinto, descarga el paquete publicado y extrae solo sus archivos necesarios. Las actualizaciones posteriores se realizan online.

Las pruebas Windows cubren el EXE, el icono Win32 y el recurso de barra de tareas, un modal nativo real, retención del ZIP durante el modal, instalación y recuperación con progress.json bloqueado por un proceso Windows, conservación de datos sintéticos, y el parche real contra la base publicada.
