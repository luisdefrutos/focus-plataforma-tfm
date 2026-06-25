# Chuleta: Flujo de Trabajo con Git y Azure DevOps

Esta guía resume los pasos diarios para trabajar de forma segura en equipo usando ramas (branches) y Pull Requests en Azure DevOps, evitando conflictos directos en la rama principal (`main`).

---

## 1. Empezar una nueva tarea (Crear rama)
Siempre que vayas a desarrollar una funcionalidad nueva o arreglar un bug, hazlo en una rama aislada.

```bash
# 1. Asegúrate de estar en la rama principal
git checkout main

# 2. Descarga lo último del servidor (por si tu compañero subió algo)
git pull origin main

# 3. Crea una rama nueva y muévete a ella automáticamente
# Tip: Usa prefijos como feat/ (nueva funcionalidad), fix/ (arreglo), docs/ (documentación)
git checkout -b feat/nombre-de-tu-tarea
```
*Ya estás trabajando en tu universo paralelo. Todo lo que hagas no afectará a `main`.*

---

## 2. Guardar y subir tu trabajo (Commit & Push)
A medida que trabajas, vas guardando tus cambios localmente y, cuando terminas, los subes a DevOps.

```bash
# 1. Prepara todos los archivos modificados
git add .

# 2. Guarda el "paquete" con un mensaje descriptivo
git commit -m "feat: descripción breve de lo que has hecho"

# 3. Sube tu rama al servidor de Azure DevOps por primera vez
# (El "-u origin" enlaza tu rama local con la remota)
git push -u origin feat/nombre-de-tu-tarea
```
*(Si después haces más commits en esta misma rama, bastará con ejecutar solo `git push`).*

---

## 3. Unir tu código con el principal (Pull Request)
No unas tu código desde la terminal. Hazlo desde la interfaz web de DevOps para mayor seguridad.

1. Abre el navegador y ve a tu proyecto en **Azure DevOps**.
2. En el menú lateral izquierdo, ve a **Repos** > **Pull requests**.
3. DevOps suele mostrar una alerta de que acabas de subir una rama. Haz clic en **Create a pull request**.
4. **Verifica:** Asegúrate de que estás uniendo tu rama (`feat/nombre-de-tu-tarea`) hacia `main`.
5. **Configura:** Ponle un título descriptivo y, si quieres, añade a tu compañero en la sección "Reviewers".
6. Haz clic en el botón **Create**.

---

## 4. Finalizar la unión (Merge)
Una vez que el Pull Request está aprobado y verificado:

1. En la misma pantalla del Pull Request en DevOps, arriba a la derecha verás el botón **Complete** (o Merge).
2. Haz clic en él. Asegúrate de marcar la casilla **"Delete <nombre-de-tu-rama> after merging"** para mantener limpio el servidor.
3. Confirma haciendo clic en **Complete merge**.
*¡Enhorabuena! Tu código ya forma parte oficial de `main`.*

---

## 5. Limpiar y volver a empezar
Tu trabajo ya está en el servidor. Ahora debes actualizar tu ordenador local para la siguiente tarea.

```bash
# 1. Vuelve a la rama principal
git checkout main

# 2. Descárgate el código actualizado (que ahora incluye tu reciente fusión)
git pull origin main

# 3. (Opcional pero recomendado) Borra la rama local que ya no necesitas
git branch -d feat/nombre-de-tu-tarea
```
*Ya estás listo para volver al Paso 1 con tu siguiente tarea.*
