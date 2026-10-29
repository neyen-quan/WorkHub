# WorkHub

Este repositorio es únicamente WorkHub. Conservar appId agency.neyen.workhub, userData workhub-desktop, origen 127.0.0.1:5173 y particiones persist:workhub-*.
El usuario autoriza cambios, incremento de versión y push a main. CI crea tags y releases; no publicarlas manualmente.
Auditar privacidad, ejecutar pruebas y comprobar el pipeline Windows y assets reales antes de anunciar una actualización.
Parchear contra paquetes publicados exactos, nunca sobrescribirlos ni recompilar bases. Recuperar tags mediante workflow_dispatch desde main y sus herramientas actuales.
No cambiar el lanzador estable ni desktop-start.cjs en parches normales. Progreso en memoria/IPC; nunca depender de progress.json. Registros críticos con temporales únicos y reintentos asíncronos.
La aceptación de instalación, reinicio y datos en la PC queda pendiente del usuario.
