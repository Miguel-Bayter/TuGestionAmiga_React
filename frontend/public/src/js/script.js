/*
  script.js

  Este archivo contiene la lógica de JavaScript para las interacciones
  de la interfaz de usuario en la aplicación.

  Este archivo existe por dos razones:
  1) UI (maquetación): menú móvil, filtros activos, toggle de vista.
  2) Integración con MySQL vía backend Node.js:
     - El navegador no puede ejecutar SQL directamente.
     - Por eso consumimos una API REST (/api/*) con fetch y renderizamos las cards.
*/

// 'DOMContentLoaded' asegura que el script se ejecute solo después de que el HTML se haya cargado completamente.
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Lógica para el Menú Lateral Móvil ---

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const sidebar = document.getElementById('sidebar');

    // Verifica que ambos elementos existan antes de añadir el evento.
    if (mobileMenuButton && sidebar) {
        // Al hacer clic en el botón del menú móvil...
        mobileMenuButton.addEventListener('click', () => {
            // ...se añade o quita la clase '-translate-x-full',
            // que mueve el sidebar dentro o fuera de la vista.
            sidebar.classList.toggle('-translate-x-full');
        });
    }

    // --- Lógica para el Filtro Activo ---

    // Selecciona el contenedor de los botones de filtro.
    // Contenedor de filtros (links con data-filter). Si no existe, no se aplica esta lógica.
    const filterContainer = document.getElementById('filter-buttons');
    const resultsContainer = document.getElementById('results-container');
    const viewToggleButton = document.getElementById('view-toggle');
    const viewToggleLabel = document.getElementById('view-toggle-label');
    const prestamosTbody = document.getElementById('prestamos-tbody');
    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');

    // Botón de cuenta.html para abrir el modal de cambio de contraseña.
    // Si no estamos en cuenta.html, este elemento no existe y no pasa nada.
    const changePasswordBtn = document.getElementById('change-password-btn');

    // Panel visual (cuenta.html):
    // - Esta es la versión “gráfica” (inputs + mensajes) sin modal.
    // - Se controla solo con clases (hidden) para mantenerlo simple.
    const changePasswordPanel = document.getElementById('change-password-panel');
    const cpCurrent = document.getElementById('cp-current');
    const cpNew = document.getElementById('cp-new');
    const cpConfirm = document.getElementById('cp-confirm');
    const cpError = document.getElementById('cp-error');
    const cpSuccess = document.getElementById('cp-success');
    const cpCancel = document.getElementById('cp-cancel');
    const cpSave = document.getElementById('cp-save');

    // Apartado de “¿Olvidaste tu contraseña?” en login.html:
    // - Es un panel agradable dentro de la tarjeta de login (sin salir de la página).
    // - El flujo es en 2 pasos: pedir código -> usar código para restablecer.
    // - En la maqueta el backend responde el código en `demo_code` para poder probarlo.
    const loginForgotPasswordToggle = document.getElementById('login-forgot-password-toggle');
    const loginForgotPasswordPanel = document.getElementById('login-forgot-password-panel');
    const lfpCancel = document.getElementById('lfp-cancel');
    const lfpStep1 = document.getElementById('lfp-step-1');
    const lfpStep2 = document.getElementById('lfp-step-2');
    const lfpEmail = document.getElementById('lfp-email');
    const lfpSend = document.getElementById('lfp-send');
    const lfpCode = document.getElementById('lfp-code');
    const lfpNew = document.getElementById('lfp-new');
    const lfpConfirm = document.getElementById('lfp-confirm');
    const lfpReset = document.getElementById('lfp-reset');
    const lfpError = document.getElementById('lfp-error');
    const lfpSuccess = document.getElementById('lfp-success');

    // ==========================================================
    //  Sesión simple y utilidades (frontend HTML)
    // ==========================================================
    // En el frontend HTML no existe un estado global como en React.
    // Por eso se crean helpers y se guardan datos en localStorage.

    /*
      Auth mínima (maqueta):
      - Guardamos un objeto de usuario en localStorage.
      - No es una sesión real con cookies/JWT; es suficiente para la demo.
      - Se usa para permitir acciones (comprar/rentar) sin hardcodear el usuario.
    */
    const AUTH_STORAGE_KEY = 'tga_auth_user';

    /*
      safeJson:
      - Evita romper el flujo si el backend responde sin JSON o hay un error.
      - Permite manejar errores mostrando mensajes más seguros.
    */
    const safeJson = async (response) => {
        try {
            return await response.json();
        } catch {
            return null;
        }
    };

    // setForgotError / setForgotSuccess:
    // - Helpers visuales para el panel "Olvidaste tu contraseña".
    // - Encapsulan el show/hide de mensajes para no repetir código.

    const setForgotError = (msg) => {
        if (!lfpError) return;
        if (!msg) {
            lfpError.textContent = '';
            lfpError.classList.add('hidden');
            return;
        }
        lfpError.textContent = String(msg);
        lfpError.classList.remove('hidden');
    };

    const setForgotSuccess = (msg) => {
        if (!lfpSuccess) return;
        if (!msg) {
            lfpSuccess.textContent = '';
            lfpSuccess.classList.add('hidden');
            return;
        }
        lfpSuccess.textContent = String(msg);
        lfpSuccess.classList.remove('hidden');
    };

    const resetForgotPanel = () => {
        setForgotError('');
        setForgotSuccess('');

        if (lfpStep1) lfpStep1.classList.remove('hidden');
        if (lfpStep2) lfpStep2.classList.add('hidden');

        if (lfpCode) lfpCode.value = '';
        if (lfpNew) lfpNew.value = '';
        if (lfpConfirm) lfpConfirm.value = '';

        if (lfpSend) {
            lfpSend.disabled = false;
            lfpSend.classList.remove('opacity-60');
            lfpSend.textContent = 'Enviar código';
        }
        if (lfpReset) {
            lfpReset.disabled = false;
            lfpReset.classList.remove('opacity-60');
            lfpReset.textContent = 'Restablecer';
        }
    };

    const toggleForgotPanel = (nextVisible) => {
        if (!loginForgotPasswordPanel) return;

        const isHidden = loginForgotPasswordPanel.classList.contains('hidden');
        const shouldShow = typeof nextVisible === 'boolean' ? nextVisible : isHidden;

        if (shouldShow) {
            loginForgotPasswordPanel.classList.remove('hidden');
            resetForgotPanel();

            // Si el usuario ya escribió el correo en el input de login, lo reutilizamos.
            if (lfpEmail && !lfpEmail.value) {
                const loginEmail = document.querySelector('input[name="email"]');
                if (loginEmail?.value) lfpEmail.value = loginEmail.value;
            }

            if (lfpEmail) lfpEmail.focus();
        } else {
            loginForgotPasswordPanel.classList.add('hidden');
            resetForgotPanel();
        }
    };

    // Eventos del apartado “¿Olvidaste tu contraseña?”
    if (loginForgotPasswordToggle) {
        loginForgotPasswordToggle.addEventListener('click', () => {
            toggleForgotPanel();
        });
    }

    if (lfpCancel) {
        lfpCancel.addEventListener('click', () => {
            toggleForgotPanel(false);
        });
    }

    if (lfpSend) {
        lfpSend.addEventListener('click', async () => {
            setForgotError('');
            setForgotSuccess('');

            const correo = lfpEmail?.value || '';
            if (!correo) {
                setForgotError('Escribe tu correo');
                return;
            }

            lfpSend.disabled = true;
            lfpSend.classList.add('opacity-60');
            lfpSend.textContent = 'Enviando...';

            try {
                // Paso 1: pedir código temporal.
                const res = await fetch('/api/password/forgot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    lfpSend.disabled = false;
                    lfpSend.classList.remove('opacity-60');
                    lfpSend.textContent = 'Enviar código';
                    setForgotError(data?.error || 'No se pudo enviar el código');
                    return;
                }

                setForgotSuccess('Si el correo existe, se generó un código temporal.');

                // En la maqueta mostramos el código para poder probar sin email.
                if (data?.demo_code && lfpCode) {
                    lfpCode.value = String(data.demo_code);
                    setForgotSuccess(`Código generado (demo): ${String(data.demo_code)}`);
                }

                if (lfpStep1) lfpStep1.classList.add('hidden');
                if (lfpStep2) lfpStep2.classList.remove('hidden');
                if (lfpCode) lfpCode.focus();

                lfpSend.disabled = false;
                lfpSend.classList.remove('opacity-60');
                lfpSend.textContent = 'Enviar código';
            } catch {
                lfpSend.disabled = false;
                lfpSend.classList.remove('opacity-60');
                lfpSend.textContent = 'Enviar código';
                setForgotError('No se pudo enviar el código');
            }
        });
    }

    if (lfpReset) {
        lfpReset.addEventListener('click', async () => {
            setForgotError('');
            setForgotSuccess('');

            const correo = lfpEmail?.value || '';
            const code = lfpCode?.value || '';
            const new_password = lfpNew?.value || '';
            const confirm = lfpConfirm?.value || '';

            if (!correo || !code || !new_password || !confirm) {
                setForgotError('Completa todos los campos');
                return;
            }
            if (new_password !== confirm) {
                setForgotError('La nueva contraseña y la confirmación no coinciden');
                return;
            }

            lfpReset.disabled = true;
            lfpReset.classList.add('opacity-60');
            lfpReset.textContent = 'Restableciendo...';

            try {
                // Paso 2: validar el código y guardar la nueva contraseña hasheada.
                const res = await fetch('/api/password/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, code, new_password })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    lfpReset.disabled = false;
                    lfpReset.classList.remove('opacity-60');
                    lfpReset.textContent = 'Restablecer';
                    setForgotError(data?.error || 'No se pudo restablecer la contraseña');
                    return;
                }

                setForgotSuccess('Contraseña restablecida. Ya puedes iniciar sesión.');
                resetForgotPanel();

                lfpReset.disabled = false;
                lfpReset.classList.remove('opacity-60');
                lfpReset.textContent = 'Restablecer';
            } catch {
                lfpReset.disabled = false;
                lfpReset.classList.remove('opacity-60');
                lfpReset.textContent = 'Restablecer';
                setForgotError('No se pudo restablecer la contraseña');
            }
        });
    }

    // ==========================================================
    //  Cuenta: cambio de contraseña (panel inline)
    // ==========================================================
    // cuenta.html tiene dos variantes de UI:
    // 1) Un panel inline (inputs dentro de la página).
    // 2) Un modal (fallback) si el panel no existe.
    //
    // Estas funciones controlan el panel inline.

    const setPanelError = (msg) => {
        if (!cpError) return;
        if (!msg) {
            cpError.textContent = '';
            cpError.classList.add('hidden');
            return;
        }
        cpError.textContent = String(msg);
        cpError.classList.remove('hidden');
    };

    const setPanelSuccess = (msg) => {
        if (!cpSuccess) return;
        if (!msg) {
            cpSuccess.textContent = '';
            cpSuccess.classList.add('hidden');
            return;
        }
        cpSuccess.textContent = String(msg);
        cpSuccess.classList.remove('hidden');
    };

    const resetPasswordPanel = () => {
        setPanelError('');
        setPanelSuccess('');
        if (cpCurrent) cpCurrent.value = '';
        if (cpNew) cpNew.value = '';
        if (cpConfirm) cpConfirm.value = '';
        if (cpSave) {
            cpSave.disabled = false;
            cpSave.classList.remove('opacity-60');
            cpSave.textContent = 'Guardar';
        }
    };

    const togglePasswordPanel = (nextVisible) => {
        if (!changePasswordPanel) return;

        const isHidden = changePasswordPanel.classList.contains('hidden');
        const shouldShow = typeof nextVisible === 'boolean' ? nextVisible : isHidden;

        if (shouldShow) {
            changePasswordPanel.classList.remove('hidden');
            resetPasswordPanel();
            if (cpCurrent) cpCurrent.focus();
        } else {
            changePasswordPanel.classList.add('hidden');
            resetPasswordPanel();
        }
    };

    // ==========================================================
    //  Cuenta: cambio de contraseña (modal lazy)
    // ==========================================================
    // ¿Por qué un modal "lazy"?
    // - Evitamos meter markup extra dentro del HTML.
    // - Se crea solo si el usuario lo necesita.
    // - Se reutiliza (solo una instancia) para no duplicar listeners.

    // Modal para cambiar contraseña:
    // - Se crea solo una vez (lazy) para no llenar el HTML de cuenta.html con más markup.
    // - Se muestra/oculta con clases + transición (mismo estilo que el modal de detalles).
    let passwordModal = null;

    const getOrCreatePasswordModal = () => {
        if (passwordModal) return passwordModal;

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-200 opacity-0';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const panel = document.createElement('div');
        panel.className = 'w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 transform scale-95 opacity-0';

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3 p-5 text-white bg-gradient-to-r from-indigo-600 to-sky-500';

        const title = document.createElement('h3');
        title.className = 'text-lg font-extrabold tracking-tight';
        title.textContent = 'Cambiar contraseña';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20';
        closeBtn.textContent = '✕';

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'p-5 space-y-4';

        const error = document.createElement('p');
        error.className = 'hidden rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700';

        const makeField = (labelText, inputId) => {
            const wrap = document.createElement('div');
            const label = document.createElement('label');
            label.className = 'block text-sm font-medium text-gray-700';
            label.setAttribute('for', inputId);
            label.textContent = labelText;
            const input = document.createElement('input');
            input.id = inputId;
            input.type = 'password';
            input.className = 'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';
            wrap.appendChild(label);
            wrap.appendChild(input);
            return { wrap, input };
        };

        const currentField = makeField('Contraseña actual', 'pwd-current');
        const nextField = makeField('Nueva contraseña', 'pwd-next');
        const confirmField = makeField('Confirmar nueva contraseña', 'pwd-confirm');

        const actions = document.createElement('div');
        actions.className = 'flex items-center justify-end gap-2 pt-2';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100';
        cancelBtn.textContent = 'Cancelar';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700';
        saveBtn.textContent = 'Guardar';

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);

        body.appendChild(error);
        body.appendChild(currentField.wrap);
        body.appendChild(nextField.wrap);
        body.appendChild(confirmField.wrap);
        body.appendChild(actions);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        let closeTimeout = null;
        let userId = null;

        const setError = (msg) => {
            if (!msg) {
                error.classList.add('hidden');
                error.textContent = '';
                return;
            }
            error.textContent = String(msg);
            error.classList.remove('hidden');
        };

        const close = () => {
            if (closeTimeout) window.clearTimeout(closeTimeout);
            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            panel.classList.remove('opacity-100', 'scale-100');
            panel.classList.add('opacity-0', 'scale-95');

            closeTimeout = window.setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
                document.body.style.overflow = '';
                setError('');
                currentField.input.value = '';
                nextField.input.value = '';
                confirmField.input.value = '';
                userId = null;
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-60');
                saveBtn.textContent = 'Guardar';
            }, 200);
        };

        const open = (uid) => {
            userId = Number(uid);
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            document.body.style.overflow = 'hidden';
            if (closeTimeout) window.clearTimeout(closeTimeout);
            window.requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
                panel.classList.remove('opacity-0', 'scale-95');
                panel.classList.add('opacity-100', 'scale-100');
            });
            currentField.input.focus();
        };

        // submit:
        // - Valida campos (no vacíos, confirmación coincide).
        // - Llama al backend para cambiar la contraseña.
        // - Muestra errores dentro del modal para que el usuario entienda qué pasó.
        const submit = async () => {
            setError('');

            if (!Number.isFinite(Number(userId))) {
                setError('No hay usuario activo');
                return;
            }

            const current_password = currentField.input.value || '';
            const new_password = nextField.input.value || '';
            const confirm = confirmField.input.value || '';

            if (!current_password || !new_password || !confirm) {
                setError('Completa todos los campos');
                return;
            }
            if (new_password !== confirm) {
                setError('La nueva contraseña y la confirmación no coinciden');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-60');
            saveBtn.textContent = 'Guardando...';

            try {
                // El backend valida la contraseña actual y guarda la nueva hasheada.
                // Se manda también id_usuario para evitar cambios accidentales a otro usuario.
                const res = await fetch(`/api/usuarios/${encodeURIComponent(userId)}/password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: userId, current_password, new_password })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    saveBtn.disabled = false;
                    saveBtn.classList.remove('opacity-60');
                    saveBtn.textContent = 'Guardar';
                    setError(data?.error || 'No se pudo cambiar la contraseña');
                    return;
                }

                window.alert('Contraseña actualizada');
                close();
            } catch {
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-60');
                saveBtn.textContent = 'Guardar';
                setError('No se pudo cambiar la contraseña');
            }
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        closeBtn.addEventListener('click', close);
        cancelBtn.addEventListener('click', close);
        saveBtn.addEventListener('click', submit);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        passwordModal = { open, close };
        return passwordModal;
    };

    // ==========================================================
    //  Auth mínima (localStorage)
    // ==========================================================
    // getStoredUser:
    // - Lee el usuario desde localStorage.
    // - Se usa para:
    //   - Mostrar datos en cuenta.html
    //   - Permitir comprar/prestar en el catálogo
    //   - Cargar préstamos del usuario
    const getStoredUser = () => {
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    // setStoredUser:
    // - Guarda el objeto usuario que viene del backend (/api/login o /api/register).
    // - Esto permite que al recargar la página no se pierda la sesión.
    const setStoredUser = (user) => {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    };

    // Limpia la sesión “simple” del frontend.
    // Se usa cuando el backend nos dice que el usuario ya no existe en la BD,
    // para evitar que el localStorage quede con datos viejos que rompen compras/préstamos.
    const clearStoredUser = () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    };

    // ==========================================================
    //  Portadas (covers)
    // ==========================================================
    // La BD no almacena URL de portada.
    // Por eso:
    // - El backend expone /api/covers con la lista de archivos reales.
    // - El frontend intenta hacer match por título.

    /*
      createCoverDataUri:
      - Como la BD no tiene URL de imagen, generamos una portada simple con SVG.
      - Esto evita depender de assets locales y mantiene el render “siempre usable”.
    */
    const createCoverDataUri = (title) => {
        const safeTitle = String(title || 'Libro').slice(0, 22);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4f46e5"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="22" fill="white">${safeTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text></svg>`;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    // Normalización de texto para comparar títulos con nombres de archivos.
    // Ej: "Fundamentos de Java" -> "fundamentos java" (sin tildes, sin dobles espacios, etc.)
    const normalizeCoverKey = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

    const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las']);

    const normalizeForMatch = (value) => normalizeCoverKey(value)
        .replace(/[_-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .filter((w) => !STOPWORDS.has(w))
        .join(' ');

    let coverMap = null;
    let coverMapPromise = null;

    // buildCoverMap:
    // - Llama al backend (/api/covers) para traer la lista real de imágenes disponibles.
    // - Crea un Map("titulo normalizado" -> "/src/assets/images/archivo.jpg").
    // - Se cachea con coverMapPromise para no pedirlo varias veces (libros + préstamos).
    const buildCoverMap = async () => {
        if (coverMapPromise) return coverMapPromise;

        coverMapPromise = (async () => {
            const map = new Map();

            try {
                const res = await fetch('/api/covers');
                const files = await safeJson(res);
                if (!res.ok || !Array.isArray(files)) {
                    coverMap = map;
                    return map;
                }

                files.forEach((file) => {
                    const base = String(file || '').replace(/\.[^/.]+$/, '');
                    const key = normalizeForMatch(base);
                    if (!key) return;
                    map.set(key, `/src/assets/images/${file}`);
                });
            } catch {
            }

            coverMap = map;
            return map;
        })();

        return coverMapPromise;
    };

    const getLocalCoverUrl = (title) => {
        if (!coverMap) return '';
        const key = normalizeForMatch(title);
        return coverMap.get(key) || '';
    };

    // ==========================================================
    //  Modal de detalles (HTML)
    // ==========================================================
    // Modal de detalles:
    // - En vez de usar alert (muy básico), se crea un overlay con estilo del proyecto.
    // - Se crea solo 1 vez (lazy) y luego se reutiliza.
    let detailsModal = null;

    const getOrCreateDetailsModal = () => {
        if (detailsModal) return detailsModal;

        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity duration-200 opacity-0';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const panel = document.createElement('div');
        // Panel responsive:
        // - max-h para que nunca se salga de la pantalla.
        // - flex-col para poder hacer scroll solo en el body (el header queda fijo).
        panel.className = 'flex flex-col w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-200 transform scale-95 opacity-0';

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3 p-5 text-white bg-gradient-to-r from-indigo-600 to-sky-500';

        // Header del modal:
        // - Mantengo el degradado del proyecto.
        // - Agrego un breadcrumb (texto pequeño) para que se parezca a “Libros > Detalle del Libro”.
        // - El título de arriba queda fijo en “Detalle del Libro” (el título real del libro va en el body).
        const headerLeft = document.createElement('div');
        headerLeft.className = 'space-y-1';

        const breadcrumb = document.createElement('p');
        breadcrumb.className = 'text-xs font-medium text-white/80';
        breadcrumb.textContent = 'Libros > Detalle del Libro';

        const title = document.createElement('h3');
        title.className = 'text-xl font-extrabold tracking-tight';
        title.textContent = 'Detalle del Libro';

        headerLeft.appendChild(breadcrumb);
        headerLeft.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20';
        closeBtn.textContent = '✕';

        header.appendChild(headerLeft);
        header.appendChild(closeBtn);

        // Body del modal (layout tipo “Detalle del Libro”):
        // - Un “card” interno con borde/sombra.
        // - Izquierda: portada + estado.
        // - Derecha: título del libro, autor, categoría, descripción y botones.
        const body = document.createElement('div');
        // Body con scroll interno:
        // - En pantallas pequeñas el modal puede crecer por el historial.
        // - Con overflow-y-auto evitamos que se “corte” el contenido.
        body.className = 'flex-1 overflow-y-auto bg-gray-50 p-5';

        const detailCard = document.createElement('div');
        detailCard.className = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

        const detailGrid = document.createElement('div');
        detailGrid.className = 'grid grid-cols-1 gap-6 p-5 md:grid-cols-[240px_1fr]';

        const leftCol = document.createElement('div');
        // Columna izquierda:
        // - En móvil centramos la portada.
        // - En desktop se alinea normal.
        leftCol.className = 'flex flex-col items-center space-y-3 md:items-stretch';

        const cover = document.createElement('img');
        // Portada responsive:
        // - En móvil usamos un ancho máximo para que no se vea gigante.
        // - En desktop se adapta al ancho de la columna.
        cover.className = 'w-full max-w-[260px] rounded-2xl border border-gray-100 object-cover shadow-sm md:max-w-none aspect-[3/4]';
        cover.alt = 'Portada del libro';

        const availabilityPill = document.createElement('span');
        availabilityPill.className = 'inline-flex w-fit items-center rounded-full px-4 py-1 text-xs font-semibold self-center md:self-start';

        leftCol.appendChild(cover);
        leftCol.appendChild(availabilityPill);

        const rightCol = document.createElement('div');
        // min-w-0 ayuda a que los textos largos hagan wrap en vez de romper el layout.
        rightCol.className = 'min-w-0 space-y-3';

        const bookTitle = document.createElement('h4');
        // Título con tamaño adaptativo (móvil vs desktop).
        bookTitle.className = 'text-xl md:text-2xl font-extrabold tracking-tight text-gray-900';

        // Meta del libro (autor + categoría):
        // - Lo muestro como filas con labels.
        // - La categoría la convierto en chip para que visualmente se entienda mejor.
        const metaWrap = document.createElement('div');
        metaWrap.className = 'space-y-2';

        const author = document.createElement('div');
        author.className = 'flex flex-wrap items-center gap-2 text-sm text-gray-700';

        const category = document.createElement('div');
        category.className = 'flex flex-wrap items-center gap-2 text-sm text-gray-700';

        const descLabel = document.createElement('p');
        descLabel.className = 'text-sm font-bold text-gray-900';
        descLabel.textContent = 'Descripción';

        const desc = document.createElement('p');
        desc.className = 'text-sm leading-relaxed text-gray-700 whitespace-pre-line';

        // Caja para que la descripción no se vea “pegada” al resto.
        // Esto mejora el look en pantallas grandes y también en móvil.
        const descBox = document.createElement('div');
        descBox.className = 'rounded-xl border border-gray-200 bg-white p-4';
        descBox.appendChild(descLabel);
        descBox.appendChild(desc);

        const actionsRow = document.createElement('div');
        // Botones responsive:
        // - En móvil se apilan (grid-cols-1).
        // - En sm+ se ponen en 3 columnas.
        actionsRow.className = 'mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3';

        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
        buyBtn.textContent = 'Comprar';

        const rentBtn = document.createElement('button');
        rentBtn.type = 'button';
        rentBtn.className = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50';
        rentBtn.textContent = 'Prestar';

        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-300';
        backBtn.textContent = 'Regresar';

        actionsRow.appendChild(buyBtn);
        actionsRow.appendChild(rentBtn);
        actionsRow.appendChild(backBtn);

        rightCol.appendChild(bookTitle);
        metaWrap.appendChild(author);
        metaWrap.appendChild(category);
        rightCol.appendChild(metaWrap);
        rightCol.appendChild(descBox);
        rightCol.appendChild(actionsRow);

        detailGrid.appendChild(leftCol);
        detailGrid.appendChild(rightCol);
        detailCard.appendChild(detailGrid);
        body.appendChild(detailCard);

        // Sección extra: historial de préstamos.
        // La idea es que dentro del modal también se pueda ver “quién lo ha rentado”.
        // Esto se llena con un fetch a /api/libros/:id/historial cuando se abre el detalle.
        const historyWrap = document.createElement('div');
        historyWrap.className = 'mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm';

        const historyHeader = document.createElement('div');
        historyHeader.className = 'border-b border-gray-200 px-5 py-4';

        const historyTitle = document.createElement('h5');
        historyTitle.className = 'text-base font-extrabold tracking-tight text-gray-900';
        historyTitle.textContent = 'Préstamos anteriores';

        historyHeader.appendChild(historyTitle);

        const historyBody = document.createElement('div');
        historyBody.className = 'p-5';

        // contenedor donde vamos a pintar la tabla o los mensajes.
        const historyContent = document.createElement('div');
        historyBody.appendChild(historyContent);

        historyWrap.appendChild(historyHeader);
        historyWrap.appendChild(historyBody);
        body.appendChild(historyWrap);

        panel.appendChild(header);
        panel.appendChild(body);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        let closeTimeout = null;

        // close:
        // - Aplica animación de salida (opacity/scale) y luego lo oculta.
        // - También devuelve el scroll al body.
        const close = () => {
            if (closeTimeout) window.clearTimeout(closeTimeout);

            overlay.classList.remove('opacity-100');
            overlay.classList.add('opacity-0');
            panel.classList.remove('opacity-100', 'scale-100');
            panel.classList.add('opacity-0', 'scale-95');

            closeTimeout = window.setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');
                document.body.style.overflow = '';
            }, 200);
        };

        // open:
        // - Pinta título/autor/descripcion y opcionalmente chips.
        // - Carga portada local si existe; si no existe usa fallback SVG.
        // - Muestra overlay + panel con animación.
        // Estado actual del libro abierto en el modal.
        // Se usa para ejecutar Comprar/Prestar desde el mismo modal.
        let currentBook = null;

        const formatHistoryDate = (value) => {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return String(value || '');
            return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const setLabeledValue = (el, label, value) => {
            // Helper para pintar filas tipo: [Label:] [Valor]
            // Se usa para mantener el HTML consistente sin repetir código.
            el.innerHTML = '';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'font-semibold text-gray-900';
            labelSpan.textContent = `${label}:`;

            const valueSpan = document.createElement('span');
            valueSpan.className = 'text-gray-700';
            valueSpan.textContent = value || '-';

            el.appendChild(labelSpan);
            el.appendChild(valueSpan);
        };

        const renderHistory = (rows) => {
            historyContent.innerHTML = '';

            if (!Array.isArray(rows) || rows.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-sm text-gray-500';
                empty.textContent = 'Este libro todavía no tiene préstamos registrados.';
                historyContent.appendChild(empty);
                return;
            }

            // Historial responsive:
            // - Móvil: cards (más legible en pantallas pequeñas).
            // - sm+: tabla (como en la referencia).
            const cardsWrap = document.createElement('div');
            cardsWrap.className = 'space-y-3 sm:hidden';

            rows.forEach((row) => {
                const card = document.createElement('div');
                card.className = 'rounded-xl border border-gray-200 bg-white p-4';

                const userLine = document.createElement('p');
                userLine.className = 'text-sm font-semibold text-gray-900';
                userLine.textContent = row?.nombre || row?.correo || 'Usuario';

                const dates = document.createElement('div');
                dates.className = 'mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700';

                const startLine = document.createElement('p');
                startLine.innerHTML = `<span class="font-semibold text-gray-900">Préstamo:</span> ${formatHistoryDate(row?.fecha_prestamo)}`;

                const endLine = document.createElement('p');
                endLine.innerHTML = `<span class="font-semibold text-gray-900">Devolución:</span> ${formatHistoryDate(row?.fecha_devolucion)}`;

                dates.appendChild(startLine);
                dates.appendChild(endLine);

                card.appendChild(userLine);
                card.appendChild(dates);
                cardsWrap.appendChild(card);
            });

            historyContent.appendChild(cardsWrap);

            const tableWrap = document.createElement('div');
            tableWrap.className = 'hidden sm:block overflow-x-auto';

            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';

            const thead = document.createElement('thead');
            thead.className = 'bg-gray-50';
            thead.innerHTML = `
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Usuario</th>
                    <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Fecha de préstamo</th>
                    <th class="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">Fecha de devolución</th>
                </tr>
            `;

            const tbody = document.createElement('tbody');
            tbody.className = 'divide-y divide-gray-200 bg-white';

            rows.forEach((row) => {
                const tr = document.createElement('tr');

                const tdUser = document.createElement('td');
                tdUser.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-800';
                tdUser.textContent = row?.nombre || row?.correo || 'Usuario';

                const tdStart = document.createElement('td');
                tdStart.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
                tdStart.textContent = formatHistoryDate(row?.fecha_prestamo);

                const tdEnd = document.createElement('td');
                tdEnd.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600';
                tdEnd.textContent = formatHistoryDate(row?.fecha_devolucion);

                tr.appendChild(tdUser);
                tr.appendChild(tdStart);
                tr.appendChild(tdEnd);
                tbody.appendChild(tr);
            });

            table.appendChild(thead);
            table.appendChild(tbody);
            tableWrap.appendChild(table);
            historyContent.appendChild(tableWrap);
        };

        const loadHistoryForBook = async (id_libro) => {
            // Estado de “cargando” para que el usuario entienda que se está trayendo info.
            historyContent.innerHTML = '';
            const loading = document.createElement('p');
            loading.className = 'text-sm text-gray-500';
            loading.textContent = 'Cargando historial...';
            historyContent.appendChild(loading);

            if (!Number.isFinite(Number(id_libro))) {
                renderHistory([]);
                return;
            }

            try {
                const res = await fetch(`/api/libros/${encodeURIComponent(id_libro)}/historial`);
                const data = await safeJson(res);
                if (!res.ok) {
                    renderHistory([]);
                    return;
                }
                renderHistory(data);
            } catch {
                // Si hay error de red o el servidor está apagado.
                const err = document.createElement('p');
                err.className = 'text-sm text-rose-600';
                err.textContent = 'No se pudo cargar el historial.';
                historyContent.innerHTML = '';
                historyContent.appendChild(err);
            }
        };

        const open = (data) => {
            currentBook = data || null;

            bookTitle.textContent = data?.titulo || 'Cargando...';

            setLabeledValue(author, 'Autor', data?.autor ? String(data.autor) : '-');

            const cat = data?.nombre_categoria || data?.categoria || '';
            category.innerHTML = '';
            const catLabel = document.createElement('span');
            catLabel.className = 'font-semibold text-gray-900';
            catLabel.textContent = 'Categoría:';
            category.appendChild(catLabel);

            if (cat) {
                const chip = document.createElement('span');
                chip.className = 'inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200';
                chip.textContent = String(cat);
                category.appendChild(chip);
            } else {
                const dash = document.createElement('span');
                dash.className = 'text-gray-700';
                dash.textContent = '-';
                category.appendChild(dash);
            }

            desc.textContent = data?.descripcion || 'Sin descripción.';

            const dispo = data?.disponibilidad;
            const isAvailable = Number(dispo) === 1;
            const hasAvailability = Number.isFinite(Number(dispo));

            // Pintamos el “pill” de disponibilidad como en la referencia.
            if (hasAvailability) {
                availabilityPill.textContent = isAvailable ? 'Disponible' : 'No disponible';
                availabilityPill.className = isAvailable
                    ? 'inline-flex w-fit items-center rounded-full bg-emerald-600 px-4 py-1 text-xs font-semibold text-white'
                    : 'inline-flex w-fit items-center rounded-full bg-rose-600 px-4 py-1 text-xs font-semibold text-white';
            } else {
                availabilityPill.textContent = 'Estado: -';
                availabilityPill.className = 'inline-flex w-fit items-center rounded-full bg-gray-200 px-4 py-1 text-xs font-semibold text-gray-800';
            }

            // Habilitamos/inhabilitamos botones según disponibilidad y si ya tenemos el id.
            const hasId = Number.isFinite(Number(data?.id_libro));
            buyBtn.disabled = !hasId || !isAvailable;
            rentBtn.disabled = !hasId || !isAvailable;

            // Cargamos historial del libro para mostrar quién lo ha rentado.
            // Esto no bloquea el modal (se muestra “Cargando historial...” mientras llega la respuesta).
            loadHistoryForBook(data?.id_libro);

            const coverUrl = getLocalCoverUrl(data?.titulo) || createCoverDataUri(data?.titulo);
            cover.src = coverUrl;
            cover.onerror = () => {
                cover.onerror = null;
                cover.src = createCoverDataUri(data?.titulo);
            };

            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
            document.body.style.overflow = 'hidden';

            if (closeTimeout) window.clearTimeout(closeTimeout);
            window.requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                overlay.classList.add('opacity-100');
                panel.classList.remove('opacity-0', 'scale-95');
                panel.classList.add('opacity-100', 'scale-100');
            });
        };

        /*
          Acciones dentro del modal:
          - Se parecen al diseño de la imagen (Comprar / Prestar / Regresar).
          - Reutilizan las mismas APIs del proyecto.
          - Cuando una acción cambia el stock, se recargan los libros para que el usuario lo vea.
        */
        buyBtn.addEventListener('click', async () => {
            const book = currentBook;
            if (!book?.id_libro) return;

            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.location.href = '/src/pages/login.html';
                return;
            }

            try {
                const res = await fetch('/api/compras', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: book.id_libro, precio: 10000 })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    const msg = data?.error || 'No se pudo registrar la compra';
                    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
                        clearStoredUser();
                        window.alert(msg);
                        window.location.href = '/src/pages/login.html';
                        return;
                    }
                    window.alert(msg);
                    return;
                }

                window.alert('Compra registrada');

                // Recargamos catálogo (si existe contenedor) y refrescamos el detalle actual.
                if (resultsContainer) await loadBooksIntoResults();
                const refreshed = await fetch(`/api/libros/${book.id_libro}`);
                const refreshedData = await safeJson(refreshed);
                if (refreshed.ok && refreshedData) open(refreshedData);
            } catch {
                window.alert('No se pudo registrar la compra');
            }
        });

        rentBtn.addEventListener('click', async () => {
            const book = currentBook;
            if (!book?.id_libro) return;

            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.location.href = '/src/pages/login.html';
                return;
            }

            const date = new Date();
            date.setDate(date.getDate() + 7);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const fecha_devolucion = `${yyyy}-${mm}-${dd}`;

            try {
                const res = await fetch('/api/prestamos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: book.id_libro, fecha_devolucion })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    const msg = data?.error || 'No se pudo registrar el préstamo';
                    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
                        clearStoredUser();
                        window.alert(msg);
                        window.location.href = '/src/pages/login.html';
                        return;
                    }
                    window.alert(msg);
                    return;
                }

                window.alert('Préstamo registrado');

                if (resultsContainer) await loadBooksIntoResults();
                const refreshed = await fetch(`/api/libros/${book.id_libro}`);
                const refreshedData = await safeJson(refreshed);
                if (refreshed.ok && refreshedData) open(refreshedData);
            } catch {
                window.alert('No se pudo registrar el préstamo');
            }
        });

        backBtn.addEventListener('click', close);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        detailsModal = { open, close };
        return detailsModal;
    };

    // showBookDetails:
    // - Abre el modal con datos básicos (para no ver un modal vacío).
    // - Luego pide el detalle real al backend (/api/libros/:id) y actualiza el modal.
    // - Si falla la petición, se queda con el fallback.
    const showBookDetails = async (bookId, fallbackBook) => {
        const modal = getOrCreateDetailsModal();
        modal.open({ titulo: fallbackBook?.titulo || 'Cargando...', autor: fallbackBook?.autor || '', descripcion: 'Cargando...' });

        try {
            const res = await fetch(`/api/libros/${bookId}`);
            const data = await safeJson(res);
            if (!res.ok || !data) return;
            modal.open(data);
        } catch {
        }
    };

    /*
      buildBookCard:
      - Renderiza una card a partir de un registro de MySQL.
      - Mantiene la estructura visual de la maqueta (cover + meta + 3 acciones).
      - disponibilidad (tinyint/boolean) controla estado y habilitación de botones.
    */
    const buildBookCard = (book) => {
        const isAvailable = Number(book?.disponibilidad) === 1;
        const statusClass = isAvailable ? 'status-instock' : 'status-rented';
        const statusText = isAvailable ? 'En stock' : 'Rentado';

        const card = document.createElement('div');
        card.className = 'card';

        const inner = document.createElement('div');
        inner.className = 'card-inner';

        const img = document.createElement('img');
        img.className = 'book-cover';
        img.alt = `Portada del libro ${book?.titulo || ''}`.trim();
        img.src = getLocalCoverUrl(book?.titulo) || createCoverDataUri(book?.titulo);
        img.onerror = () => {
            img.onerror = null;
            img.src = createCoverDataUri(book?.titulo);
        };

        const meta = document.createElement('div');
        meta.className = 'book-meta';

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-3';

        const left = document.createElement('div');
        const h3 = document.createElement('h3');
        h3.className = 'text-lg font-bold text-gray-900';
        h3.textContent = book?.titulo || 'Sin título';

        const p = document.createElement('p');
        p.className = 'text-sm text-gray-600 mt-1';
        const cat = book?.nombre_categoria ? ` · ${book.nombre_categoria}` : '';
        p.textContent = `${book?.autor || 'Autor desconocido'}${cat}`;

        left.appendChild(h3);
        left.appendChild(p);

        const badge = document.createElement('span');
        badge.className = `status-badge ${statusClass}`;
        badge.textContent = statusText;

        header.appendChild(left);
        header.appendChild(badge);

        const stock = document.createElement('p');
        stock.className = 'mt-2 text-xs text-gray-500';
        // Compatibilidad:
        // - Si el backend devuelve `stock` (cuando existe la columna en MySQL), lo mostramos.
        // - Si no existe esa columna, mantenemos el fallback anterior (1 o 0 según disponibilidad).
        const stockValue = Number.isFinite(Number(book?.stock)) ? Number(book.stock) : (isAvailable ? 1 : 0);
        stock.textContent = `Stock: ${stockValue}`;

        const actions = document.createElement('div');
        actions.className = 'book-actions';

        const detailsBtn = document.createElement('button');
        detailsBtn.className = 'btn-details';
        detailsBtn.type = 'button';
        detailsBtn.textContent = 'Ver detalles';
        /*
          Details:
          - Pide el detalle al backend y lo muestra.
          - Se usa alert por ser maqueta; en producción sería un modal/página.
        */
        detailsBtn.addEventListener('click', async () => {
            await showBookDetails(book.id_libro, book);
        });

        const buyBtn = document.createElement('button');
        buyBtn.className = 'btn-buy';
        buyBtn.type = 'button';
        buyBtn.textContent = 'Comprar';
        if (!isAvailable) {
            buyBtn.classList.add('btn-disabled');
            buyBtn.disabled = true;
        }
        /*
          Comprar:
          - Si no hay usuario en localStorage, redirige a login.
          - Registra compra en MySQL vía POST /api/compras.
        */
        buyBtn.addEventListener('click', async () => {
            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.location.href = '/src/pages/login.html';
                return;
            }

            try {
                const res = await fetch('/api/compras', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: book.id_libro, precio: 10000 })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    // Importante:
                    // - Antes esto fallaba “en silencio” (parecía que el botón no hacía nada).
                    // - Ahora mostramos el mensaje del backend.
                    const msg = data?.error || 'No se pudo registrar la compra';
                    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
                        // Si la BD ya no tiene este usuario, limpiamos sesión local y volvemos a login.
                        clearStoredUser();
                        window.alert(msg);
                        window.location.href = '/src/pages/login.html';
                        return;
                    }
                    window.alert(msg);
                    return;
                }
                window.alert('Compra registrada');
                if (resultsContainer) {
                    await loadBooksIntoResults();
                }
            } catch {
                // Si el server está apagado o hay error de red.
                window.alert('No se pudo registrar la compra');
            }
        });

        const rentBtn = document.createElement('button');
        rentBtn.className = 'btn-secondary rent-action';
        rentBtn.type = 'button';
        rentBtn.textContent = 'Rentar';
        if (!isAvailable) {
            rentBtn.classList.add('btn-disabled');
            rentBtn.disabled = true;
        }
        /*
          Rentable/Préstamo:
          - Si no hay usuario en localStorage, redirige a login.
          - POST /api/prestamos (transacción) y luego recarga libros.
        */
        rentBtn.addEventListener('click', async () => {
            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.location.href = '/src/pages/login.html';
                return;
            }

            const date = new Date();
            date.setDate(date.getDate() + 7);
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const fecha_devolucion = `${yyyy}-${mm}-${dd}`;

            try {
                const res = await fetch('/api/prestamos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: user.id_usuario, id_libro: book.id_libro, fecha_devolucion })
                });
                const data = await safeJson(res);
                if (!res.ok) {
                    // Igual que en compra: mostramos error y si el usuario ya no existe limpiamos sesión.
                    const msg = data?.error || 'No se pudo registrar el préstamo';
                    if (String(msg).toLowerCase().includes('usuario no encontrado')) {
                        clearStoredUser();
                        window.alert(msg);
                        window.location.href = '/src/pages/login.html';
                        return;
                    }
                    window.alert(msg);
                    return;
                }

                window.alert('Préstamo registrado');
                if (resultsContainer) {
                    await loadBooksIntoResults();
                }
            } catch {
                // Si el server está apagado o hay error de red.
                window.alert('No se pudo registrar el préstamo');
            }
        });

        actions.appendChild(detailsBtn);
        actions.appendChild(buyBtn);
        actions.appendChild(rentBtn);

        meta.appendChild(header);
        meta.appendChild(stock);
        meta.appendChild(actions);

        inner.appendChild(img);
        inner.appendChild(meta);
        card.appendChild(inner);
        return card;
    };

    /*
      loadBooksIntoResults:
      - Carga libros desde la API y renderiza en #results-container.
      - En rentable.html se filtra a disponibles.
      - Nota: como el contenido llega async, luego de renderizar re-aplicamos
        el filtro "comprar" para ocultar .rent-action si corresponde.
    */
    const loadBooksIntoResults = async () => {
        if (!resultsContainer) return;

        await buildCoverMap();

        const isRentablePage = window.location.pathname.toLowerCase().endsWith('rentable.html');
        const url = isRentablePage ? '/api/libros?disponible=true' : '/api/libros';

        try {
            const res = await fetch(url);
            const data = await safeJson(res);
            if (!res.ok || !Array.isArray(data)) return;

            resultsContainer.innerHTML = '';
            if (data.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'text-center text-gray-500 py-10';
                empty.textContent = 'No hay libros cargados todavía. Carga datos de ejemplo en MySQL y recarga.';
                resultsContainer.appendChild(empty);
                return;
            }
            data.forEach((book) => {
                resultsContainer.appendChild(buildBookCard(book));
            });

            const isIndexPage = window.location.pathname.toLowerCase().endsWith('index.html');
            if (isIndexPage) {
                const params = new URLSearchParams(window.location.search);
                const filter = (params.get('filter') || 'todos').toLowerCase();
                const rentButtons = document.querySelectorAll('.rent-action');
                rentButtons.forEach(btn => {
                    if (filter === 'comprar') {
                        btn.classList.add('hidden');
                    } else {
                        btn.classList.remove('hidden');
                    }
                });
            }
        } catch {
        }
    };

    /*
      Toggle de vista (lista vs grid):
      - La vista principal es lista horizontal (como referencia).
      - La vista alternativa usa grid y cards verticales.
      - Se guarda en localStorage para que al recargar no se pierda la preferencia.
      - El render de cards está desacoplado (loadBooksIntoResults) para que la vista
        se pueda aplicar tanto a cards "quemadas" como a cards cargadas por API.
    */
    const VIEW_STORAGE_KEY = 'library_view_mode';

    /*
      applyViewMode:
      - Resetea clases del contenedor para evitar mezclas (grid + space-y).
      - Luego aplica el modo solicitado.
    */
    const applyViewMode = (mode) => {
        if (!resultsContainer) return;

        // Quitamos clases previas para evitar mezclas entre layout lista y grid.
        resultsContainer.classList.remove(
            'space-y-4',
            'grid',
            'grid-cols-1',
            'sm:grid-cols-2',
            'md:grid-cols-3',
            'lg:grid-cols-4',
            'gap-6',
            'view-grid'
        );

        if (mode === 'grid') {
            // Vista alternativa: cards verticales y en grilla.
            resultsContainer.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'gap-6', 'view-grid');
            if (viewToggleLabel) viewToggleLabel.textContent = 'Vista: Grid';
        } else {
            // Vista principal: lista horizontal (referencia).
            resultsContainer.classList.add('space-y-4');
            if (viewToggleLabel) viewToggleLabel.textContent = 'Vista: Lista';
        }
    };

    /*
      initViewToggle:
      - Lee la preferencia guardada.
      - Escucha clicks y actualiza localStorage.
      - No hace nada si la página no tiene resultsContainer o botón toggle.
    */
    const initViewToggle = () => {
        if (!resultsContainer || !viewToggleButton) return;

        const saved = localStorage.getItem(VIEW_STORAGE_KEY);
        const initialMode = saved === 'grid' ? 'grid' : 'list';
        applyViewMode(initialMode);

        viewToggleButton.addEventListener('click', () => {
            const isGrid = resultsContainer.classList.contains('view-grid');
            const next = isGrid ? 'list' : 'grid';
            localStorage.setItem(VIEW_STORAGE_KEY, next);
            applyViewMode(next);
        });
    };

    // Inicializa el toggle en cualquier página que tenga contenedor de resultados.
    initViewToggle();

    loadBooksIntoResults();

    // ==========================================================
    //  Préstamos: carga de tabla (prestamos.html)
    // ==========================================================
    // loadPrestamosIntoTable:
    // - Lee el usuario desde localStorage.
    // - Llama al backend con GET /api/prestamos?id_usuario=...
    // - Renderiza filas con el diseño de la tabla.
    // - Permite devolver préstamos activos llamando POST /api/prestamos/:id/devolver.
    const loadPrestamosIntoTable = async () => {
        if (!prestamosTbody) return;

        await buildCoverMap();

        const user = getStoredUser();
        if (!user?.id_usuario) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.className = 'px-6 py-4 text-sm text-gray-500';
            td.textContent = 'Inicia sesión para ver tus préstamos.';
            tr.appendChild(td);
            prestamosTbody.innerHTML = '';
            prestamosTbody.appendChild(tr);
            return;
        }

        const formatDate = (value) => {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return String(value || '');
            return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        try {
            const res = await fetch(`/api/prestamos?id_usuario=${encodeURIComponent(user.id_usuario)}`);
            const data = await safeJson(res);
            if (!res.ok || !Array.isArray(data)) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.className = 'px-6 py-4 text-sm text-gray-500';
                td.textContent = 'No se pudieron cargar los préstamos.';
                tr.appendChild(td);
                prestamosTbody.innerHTML = '';
                prestamosTbody.appendChild(tr);
                return;
            }

            prestamosTbody.innerHTML = '';

            if (data.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.className = 'px-6 py-4 text-sm text-gray-500';
                td.textContent = 'No tienes préstamos todavía.';
                tr.appendChild(td);
                prestamosTbody.appendChild(tr);
                return;
            }

            data.forEach((row) => {
                const tr = document.createElement('tr');

                const tdBook = document.createElement('td');
                tdBook.className = 'px-6 py-4 whitespace-nowrap';
                const wrap = document.createElement('div');
                wrap.className = 'flex items-center';
                const imgWrap = document.createElement('div');
                imgWrap.className = 'flex-shrink-0 h-10 w-10';
                const img = document.createElement('img');
                img.className = 'h-10 w-10 rounded-full';
                img.alt = '';
                img.src = getLocalCoverUrl(row?.titulo) || createCoverDataUri(row?.titulo);
                img.onerror = () => {
                    img.onerror = null;
                    img.src = createCoverDataUri(row?.titulo);
                };
                imgWrap.appendChild(img);
                const meta = document.createElement('div');
                meta.className = 'ml-4';
                const title = document.createElement('div');
                title.className = 'text-sm font-medium text-gray-900';
                title.textContent = row?.titulo || 'Sin título';
                const author = document.createElement('div');
                author.className = 'text-sm text-gray-500';
                author.textContent = row?.autor || 'Autor desconocido';
                meta.appendChild(title);
                meta.appendChild(author);
                wrap.appendChild(imgWrap);
                wrap.appendChild(meta);
                tdBook.appendChild(wrap);

                const tdInicio = document.createElement('td');
                tdInicio.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                tdInicio.textContent = formatDate(row?.fecha_prestamo);

                const tdFin = document.createElement('td');
                tdFin.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                tdFin.textContent = formatDate(row?.fecha_devolucion);

                const tdEstado = document.createElement('td');
                tdEstado.className = 'px-6 py-4 whitespace-nowrap';
                const badge = document.createElement('span');
                badge.className = 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full';
                const estado = String(row?.estado || '').toLowerCase();
                if (estado.includes('activo')) {
                    badge.classList.add('bg-green-100', 'text-green-800');
                } else if (estado.includes('venc')) {
                    badge.classList.add('bg-red-100', 'text-red-800');
                } else {
                    badge.classList.add('bg-gray-100', 'text-gray-800');
                }
                badge.textContent = row?.estado || 'Desconocido';
                tdEstado.appendChild(badge);

                const tdAcciones = document.createElement('td');
                tdAcciones.className = 'px-6 py-4 whitespace-nowrap';

                // Solo dejamos devolver cuando el préstamo está activo.
                if (estado.includes('activo')) {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700';
                    btn.textContent = 'Devolver';
                    btn.addEventListener('click', async () => {
                        try {
                            const res2 = await fetch(`/api/prestamos/${encodeURIComponent(row.id_prestamo)}/devolver`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id_usuario: user.id_usuario })
                            });
                            // Intentamos leer JSON sin perder la posibilidad de leer texto si el backend responde
                            // con algo no-JSON (ej: "Cannot POST ..." cuando el endpoint no existe).
                            let data2 = null;
                            try {
                                data2 = await res2.clone().json();
                            } catch {
                                data2 = null;
                            }
                            if (!res2.ok) {
                                let msg = data2?.error;
                                if (!msg) {
                                    try {
                                        msg = await res2.text();
                                    } catch {
                                    }
                                }
                                window.alert(msg || 'No se pudo devolver el préstamo');
                                return;
                            }
                            window.alert('Libro devuelto');
                            await loadPrestamosIntoTable();
                        } catch {
                            window.alert('No se pudo devolver el préstamo');
                        }
                    });
                    tdAcciones.appendChild(btn);
                } else {
                    const span = document.createElement('span');
                    span.className = 'text-sm text-gray-400';
                    span.textContent = '-';
                    tdAcciones.appendChild(span);
                }

                tr.appendChild(tdBook);
                tr.appendChild(tdInicio);
                tr.appendChild(tdFin);
                tr.appendChild(tdEstado);
                tr.appendChild(tdAcciones);

                prestamosTbody.appendChild(tr);
            });
        } catch {
        }
    };

    loadPrestamosIntoTable();

    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.alert('Inicia sesión para cambiar la contraseña');
                window.location.href = '/src/pages/login.html';
                return;
            }

            // Si existe el panel visual, lo usamos (es el “apartado gráfico” dentro de la página).
            // Si no existe, usamos el modal como fallback.
            if (changePasswordPanel) {
                togglePasswordPanel();
            } else {
                // Abrimos el modal con el id del usuario actual guardado en localStorage.
                // (Es una demo; en una app real esto se haría con sesión/JWT y no confiaríamos en localStorage.)
                getOrCreatePasswordModal().open(user.id_usuario);
            }
        });
    }

    if (cpCancel) {
        cpCancel.addEventListener('click', () => {
            togglePasswordPanel(false);
        });
    }

    if (cpSave) {
        cpSave.addEventListener('click', async () => {
            setPanelError('');
            setPanelSuccess('');

            const user = getStoredUser();
            if (!user?.id_usuario) {
                window.alert('Inicia sesión para cambiar la contraseña');
                window.location.href = '/src/pages/login.html';
                return;
            }

            const current_password = cpCurrent?.value || '';
            const new_password = cpNew?.value || '';
            const confirm = cpConfirm?.value || '';

            // Validaciones del lado del cliente:
            // - Evitan mandar requests innecesarias.
            // - Ayudan a dar feedback rápido.
            if (!current_password || !new_password || !confirm) {
                setPanelError('Completa todos los campos');
                return;
            }
            if (new_password !== confirm) {
                setPanelError('La nueva contraseña y la confirmación no coinciden');
                return;
            }

            cpSave.disabled = true;
            cpSave.classList.add('opacity-60');
            cpSave.textContent = 'Guardando...';

            try {
                const uid = Number(user.id_usuario);
                const res = await fetch(`/api/usuarios/${encodeURIComponent(uid)}/password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_usuario: uid, current_password, new_password })
                });
                const data = await safeJson(res);

                if (!res.ok) {
                    cpSave.disabled = false;
                    cpSave.classList.remove('opacity-60');
                    cpSave.textContent = 'Guardar';
                    setPanelError(data?.error || 'No se pudo cambiar la contraseña');
                    return;
                }

                setPanelSuccess('Contraseña actualizada correctamente');
                if (cpCurrent) cpCurrent.value = '';
                if (cpNew) cpNew.value = '';
                if (cpConfirm) cpConfirm.value = '';

                cpSave.disabled = false;
                cpSave.classList.remove('opacity-60');
                cpSave.textContent = 'Guardar';
            } catch {
                cpSave.disabled = false;
                cpSave.classList.remove('opacity-60');
                cpSave.textContent = 'Guardar';
                setPanelError('No se pudo cambiar la contraseña');
            }
        });
    }

    const loadProfileIntoPage = async () => {
        if (!profileName || !profileEmail) return;

        const user = getStoredUser();
        if (!user?.id_usuario) {
            profileName.textContent = 'Inicia sesión';
            profileEmail.textContent = '-';
            return;
        }

        profileName.textContent = user?.nombre || '';
        profileEmail.textContent = user?.correo || '';

        try {
            const res = await fetch(`/api/usuarios/${encodeURIComponent(user.id_usuario)}`);
            const data = await safeJson(res);
            if (!res.ok || !data) return;

            profileName.textContent = data?.nombre || profileName.textContent;
            profileEmail.textContent = data?.correo || profileEmail.textContent;

            setStoredUser({
                id_usuario: data?.id_usuario || user.id_usuario,
                nombre: data?.nombre || user.nombre,
                correo: data?.correo || user.correo,
                id_rol: data?.id_rol ?? user.id_rol
            });
        } catch {
        }
    };

    loadProfileIntoPage();

    /*
      Filtros (Todos/Comprar/Rentable):
      - En index.html el filtro viene por querystring (?filter=comprar).
      - En rentable.html se mantiene el botón "Rentable" activo.
      - Se usa History API (pushState/popstate) para no recargar index al cambiar filtro.
      - Importante: el filtro "comprar" oculta botones con clase .rent-action.
    */
    if (filterContainer) {
        const isIndexPage = window.location.pathname.toLowerCase().endsWith('index.html');
        const isRentablePage = window.location.pathname.toLowerCase().endsWith('rentable.html');

        /*
          applyFilter:
          - Aplica el comportamiento del filtro.
          - Se limita a index.html porque rentable.html siempre es "rentable".
        */
        const applyFilter = (filter) => {
            if (!isIndexPage) return;

            const rentButtons = document.querySelectorAll('.rent-action');
            rentButtons.forEach(btn => {
                if (filter === 'comprar') {
                    btn.classList.add('hidden');
                } else {
                    btn.classList.remove('hidden');
                }
            });
        };

        /*
          setActiveFilterButton:
          - Cambia clases CSS para resaltar el botón activo.
          - Solo manipula elementos con data-filter para no afectar otros controles.
        */
        const setActiveFilterButton = (filter) => {
            const filterButtons = filterContainer.querySelectorAll('[data-filter]');

            filterButtons.forEach(btn => {
                btn.classList.remove('filter-btn-active');
                btn.classList.add('filter-btn');
            });

            const active = filterContainer.querySelector(`[data-filter="${filter}"]`);
            if (active) {
                active.classList.add('filter-btn-active');
                active.classList.remove('filter-btn');
            }
        };

        /*
          readFilterFromUrl:
          - Lee el filtro "fuente de verdad" desde la URL/página.
          - Esto permite que el botón activo se sincronice con navegación/recarga.
        */
        const readFilterFromUrl = () => {
            // En index.html el estado viene por querystring (?filter=...).
            if (isIndexPage) {
                const params = new URLSearchParams(window.location.search);
                const filter = (params.get('filter') || 'todos').toLowerCase();
                return filter === 'comprar' ? 'comprar' : 'todos';
            }

            // En rentable.html mantenemos el botón "Rentable" activo.
            if (isRentablePage) return 'rentable';

            return 'todos';
        };

        /*
          syncUiWithFilter:
          - Punto central para alinear UI (active button) + comportamiento (ocultar rent-action).
          - Se llama al cargar, al hacer click, y en popstate.
        */
        const syncUiWithFilter = () => {
            const filter = readFilterFromUrl();
            setActiveFilterButton(filter);
            applyFilter(filter);
        };

        // Estado inicial desde la URL.
        syncUiWithFilter();

        const filterButtons = filterContainer.querySelectorAll('a, button');
        filterButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const filter = button.getAttribute('data-filter');
                if (!filter) return;

                if (button.tagName === 'A') {
                    const href = button.getAttribute('href');
                    if (!href || href === '#') {
                        event.preventDefault();
                    } else {
                        const targetUrl = new URL(href, window.location.href);
                        const samePage = targetUrl.pathname === window.location.pathname;

                        /*
                          Si es la misma página (index), aplicamos el filtro sin recargar:
                          - actualizamos la querystring
                          - re-sincronizamos UI y comportamiento
                        */
                        if (samePage && isIndexPage) {
                            event.preventDefault();
                            targetUrl.searchParams.set('filter', filter);
                            window.history.pushState({}, '', targetUrl);
                        }
                    }
                }

                syncUiWithFilter();
            });
        });

        window.addEventListener('popstate', () => {
            syncUiWithFilter();
        });
    }

    /*
      Login/Registro (maqueta):
      - login.html y register.html tienen form action GET hacia index (fallback).
      - Aquí interceptamos submit para:
        1) llamar al backend (/api/login o /api/register)
        2) guardar el usuario en localStorage
        3) redirigir a index
      - Esto evita usar PHP y permite autenticar contra MySQL.
    */
    const loginForm = document.querySelector('form[action="../../index.html"][method="GET"]');
    if (loginForm && window.location.pathname.toLowerCase().endsWith('login.html')) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Tomamos los valores del formulario HTML.
            // El backend se encarga de normalizar correo (trim/lower) y validar bcrypt.
            const correo = loginForm.querySelector('input[name="email"]')?.value || '';
            const password = loginForm.querySelector('input[name="password"]')?.value || '';

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, password })
                });
                const data = await safeJson(res);
                if (!res.ok || !data) {
                    window.alert(data?.error || 'No se pudo iniciar sesión');
                    return;
                }

                // Guardamos sesión local para que el resto de páginas pueda usarla.
                setStoredUser(data);
                window.location.href = '../../index.html';
            } catch {
                window.alert('No se pudo iniciar sesión');
            }
        });
    }

    const registerForm = document.querySelector('form[action="../../index.html"][method="GET"]');
    if (registerForm && window.location.pathname.toLowerCase().endsWith('register.html')) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // En registro solo pedimos nombre/correo/password.
            // El backend guarda la contraseña hasheada (bcrypt).
            const nombre = registerForm.querySelector('input[name="name"]')?.value || '';
            const correo = registerForm.querySelector('input[name="email"]')?.value || '';
            const password = registerForm.querySelector('input[name="password"]')?.value || '';

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre, correo, password })
                });
                const data = await safeJson(res);
                if (!res.ok || !data) {
                    window.alert(data?.error || 'No se pudo registrar');
                    return;
                }

                // Igual que login: persistimos sesión simple.
                setStoredUser(data);
                window.location.href = '../../index.html';
            } catch {
                window.alert('No se pudo registrar');
            }
        });
    }
});