'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const viewLogBtn = document.querySelector('.view__log__btn');
const clearAll = document.querySelector('.clear__all__btn');
const sidebarNav = document.querySelector('.sidebar__nav');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  markers = {};

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data for localDB
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this._containerWorkoutsClickHandler.bind(this)
    );
    // this._screenHandler();
    viewLogBtn.addEventListener('click', this._showLogs);
    sidebarNav.addEventListener(
      'click',
      this._sidebarNavClickHandler.bind(this)
    );
  }

  _sidebarNavClickHandler(e) {
    if (e.target.classList.contains('clear__all__btn')) {
      this._showSidebarNav(e);
    }

    if (e.target.classList.contains('confirm__clear__all__btns--yes')) {
      this.reset();
      location.reload();
    }

    if (e.target.classList.contains('confirm__clear__all__btns--no')) {
      this._hideSidebarNav(e);
    }
  }

  _showSidebarNav(e) {
    const html = `<p class="confirm__delete">Are you sure you want to delete all workouts?</p>
    <div>
      <button class="confirm__delete__btns confirm__clear__all__btns--yes">Yes</button>
      <button class="confirm__delete__btns confirm__clear__all__btns--no">No</button>
    </div>
    `;
    e.target
      .closest('.sidebar__nav')
      .querySelector('.workout__overlay')
      .classList.remove('workout__overlay--inactive');
    e.target
      .closest('.sidebar__nav')
      .querySelector('.workout__overlay').innerHTML = html;
  }

  _hideSidebarNav(e) {
    e.target
      .closest('.sidebar__nav')
      .querySelector('.workout__overlay')
      .classList.add('workout__overlay--inactive');
    e.target
      .closest('.sidebar__nav')
      .querySelector('.workout__overlay').innerHTML = '';
  }

  _showLogs() {
    const sideBar = document.querySelector('.sidebar');
    const navLogo = document.querySelector('.nav__logo');
    navLogo.classList.toggle('nav__logo--hide');
    sideBar.classList.toggle('sidebar--show');
    navLogo.classList.contains('nav__logo--hide')
      ? (viewLogBtn.textContent = 'View map')
      : (viewLogBtn.textContent = 'View logs');
  }

  // _screenHandler() {
  //   const body = document.getElementsByTagName('body')[0];
  //   const observer = new ResizeObserver(entries => {
  //     const body = entries[0];
  //     console.log(body.contentRect.width === 1200);
  //     if (body.contentRect.width === 1200) {
  //       console.log('fired');
  //       location.reload();
  //     }
  //   });
  //   observer.observe(body);
  // }

  _getPosition() {
    if (navigator.geolocation) {
      const userLocation = navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('GPS Tracking was not allowed for this website');
        }
      );
    }
  }

  _loadMap(position) {
    const coords = [position.coords.latitude, position.coords.longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    this.#map.on('click', this._showForm.bind(this));
    this.#workouts.forEach(workout => this._renderWorkoutMarker(workout));
  }

  _showForm(mapE) {
    // Media query
    let screen = window.matchMedia('(max-width: 1200px)');
    if (screen.matches) {
      this._showLogs();
    }
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    this._clearFormInputs();
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _hideFormSmooth() {
    this._clearFormInputs();
    form.classList.add('hidden');
  }

  _clearFormInputs() {
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
  }

  _toggleElevationField() {
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    // validators
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp >= 1);

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // create running object if workout = running
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Validate data
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._formOverlayActivate();
      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // create cycling object if workout = cycling
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Validate data
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._formOverlayActivate();
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render map workout marker

    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    this.markers[workout.id] = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <div class="workout__overlay workout__overlay--inactive"></div>
            <div class="workout__title__container">
              <h2 class="workout__title">${workout.description}</h2>
              <div class="workout__actions">
                <i class="lni lni-pencil edit__workout"></i>
                <i class="lni lni-close delete__workout"></i>
              </div>
              <div class="workout__edit edit__hidden">
                <span class="edit__save"><i class="lni lni-checkmark"></i> Save</span>
                <span class="edit__cancel"><i class="lni lni-close"></i> Cancel</span>
              </div>
            </div>
            <div class="workout__details">
                <span class="workout__icon">${
                  workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
                }</span>
                <span class="workout__value workout-value--distance">${(+workout.distance)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <input class="edit__input edit__hidden edit__input--distance" placeholder="${(+workout.distance)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}" />
                <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">⏱</span>
                <span class="workout__value workout-value--duration">${(+workout.duration)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <input class="edit__input edit__hidden edit__input--duration" placeholder="${(+workout.duration)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}" />
                <span class="workout__unit">min</span>
            </div>
      `;

    if (workout.type === 'running')
      html += `
            <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value workout-value--pace">${(+workout.pace)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <span class="edit__input edit__hidden">${(+workout.pace)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <span class="workout__unit">min/km</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">🦶🏼</span>
                <span class="workout__value workout-value--cadence">${(+workout.cadence)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <input class="edit__input edit__input--cadence edit__hidden" placeholder="${(+workout.cadence)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}" />
                <span class="workout__unit">spm</span>
            </div>
        </li>
    `;
    if (workout.type === 'cycling')
      html += `
            <div class="workout__details">
                <span class="workout__icon">⚡️</span>
                <span class="workout__value workout-value--speed">${(+workout.speed)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <span class="edit__input edit__hidden">${(+workout.speed)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <span class="workout__unit">km/h</span>
            </div>
            <div class="workout__details">
                <span class="workout__icon">↗</span>
                <span class="workout__value workout-value--elevation">${(+workout.elevation)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}</span>
                <input class="edit__input edit__hidden edit__input--elevation" placeholder="${(+workout.elevation)
                  .toFixed(2)
                  .replace(/[.,]00$/, '')}" />
                <span class="workout__unit">m</span>
            </div>
        </li> 
    `;

    form.insertAdjacentHTML('afterend', html);
  }

  _formOverlayActivate() {
    const formOverlay = form.querySelector('.workout__overlay');
    const html = `
              <p class="confirm__delete">Please double check the form.</p>
              <div>
                <button class="confirm__delete__btns confirm__form__validation">Okay</button>
              </div>
    `;
    formOverlay.classList.remove('workout__overlay--inactive');
    formOverlay.innerHTML = html;
  }

  _formOverlayDeactivate(formOverlay) {
    formOverlay.innerHTML = '';
    formOverlay.classList.add('workout__overlay--inactive');
  }

  _workoutOverlayActivate(targetWorkout) {
    targetWorkout.classList.remove('workout__overlay--inactive');
  }

  _workoutOverlayDeactivate(targetWorkout) {
    targetWorkout.innerHTML = '';
    targetWorkout.classList.add('workout__overlay--inactive');
  }

  _confirmDelete(targetWorkout) {
    const html = `
              <p class="confirm__delete">Are you sure you want to delete this workout?</p>
              <div>
                <button class="confirm__delete__btns confirm__delete__btns--yes">Yes</button>
                <button class="confirm__delete__btns confirm__delete__btns--no">No</button>
              </div>
    `;
    targetWorkout.innerHTML = html;
  }

  _deleteWorkout(id) {
    let workout = this.#workouts.find(work => work.id == id);
    const toDelete = this.#workouts.indexOf(
      this.#workouts.find(work => work.id == id)
    );
    this.#workouts.splice(toDelete, 1);
    return workout;
  }

  _deleteWorkoutMarker(workout) {
    this.markers[workout.id].remove();
  }

  _showEditWorkout(id) {
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelectorAll('.workout__value')
      .forEach(value => value.classList.add('edit__hidden'));
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelectorAll('.edit__input')
      .forEach(value => value.classList.remove('edit__hidden'));
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__actions')
      .classList.add('edit__hidden');
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__edit')
      .classList.remove('edit__hidden');
    // Media query
    let screen = window.matchMedia('(max-width: 1200px)');
    if (screen.matches) {
      containerWorkouts
        .querySelector(`[data-id="${id}"]`)
        .querySelector('.workout__edit')
        .classList.add('edit__media__1200');
    }
  }

  _editCancel(id) {
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelectorAll('.workout__value')
      .forEach(value => value.classList.remove('edit__hidden'));
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelectorAll('.edit__input')
      .forEach(value => value.classList.add('edit__hidden'));
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__actions')
      .classList.remove('edit__hidden');
    containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__edit')
      .classList.add('edit__hidden');
    // Media query
    let screen = window.matchMedia('(max-width: 1200px)');
    if (screen.matches) {
      containerWorkouts
        .querySelector(`[data-id="${id}"]`)
        .querySelector('.workout__edit')
        .classList.remove('edit__media__1200');
    }
  }

  _editOverlayActivate(id) {
    const workoutDisplay = containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__overlay');
    this._workoutOverlayActivate(workoutDisplay);

    const html = `
              <p class="confirm__delete">Please double check the fields.</p>
              <div>
                <button class="confirm__delete__btns confirm__edit__validation">Okay</button>
              </div>
    `;
    workoutDisplay.classList.remove('workout__overlay--inactive');
    workoutDisplay.innerHTML = html;
  }

  _editOverlayDeactivate(id) {
    const workoutDisplay = containerWorkouts
      .querySelector(`[data-id="${id}"]`)
      .querySelector('.workout__overlay');
    workoutDisplay.innerHTML = '';
    workoutDisplay.classList.add('workout__overlay--inactive');
  }

  _editSave(id) {
    // validation helpers
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp >= 1);
    const workoutDisplay = containerWorkouts.querySelector(`[data-id="${id}"]`);
    const workout = this.#workouts.find(workout => workout.id === +id);
    // distance, duration, cadence/elevation
    let distanceNew = workoutDisplay.querySelector('.edit__input--distance')
      .value
      ? +workoutDisplay.querySelector('.edit__input--distance').value
      : workout.distance;

    let durationNew = workoutDisplay.querySelector('.edit__input--duration')
      .value
      ? +workoutDisplay.querySelector('.edit__input--duration').value
      : workout.duration;

    if (workout.type === 'running') {
      let cadenceNew = workoutDisplay.querySelector('.edit__input--cadence')
        .value
        ? +workoutDisplay.querySelector('.edit__input--cadence').value
        : workout.cadence;

      if (
        !validInputs(distanceNew, durationNew, cadenceNew) ||
        !allPositive(distanceNew, durationNew, cadenceNew)
      )
        return this._editOverlayActivate(id);
      workout.distance = distanceNew;
      workout.duration = durationNew;
      workout.cadence = cadenceNew;
      workout.pace = (+(workout.duration / workout.distance)).toFixed(2);
    }
    if (workout.type === 'cycling') {
      let elevationNew = workoutDisplay.querySelector('.edit__input--elevation')
        .value
        ? +workoutDisplay.querySelector('.edit__input--elevation').value
        : workout.elevation;

      if (
        !validInputs(distanceNew, durationNew, elevationNew) ||
        !allPositive(distanceNew, durationNew)
      )
        return this._editOverlayActivate(id);
      workout.distance = distanceNew;
      workout.duration = durationNew;
      workout.elevation = elevationNew;
      workout.speed = (workout.distance / (workout.duration / 60)).toFixed(2);
    }

    // hide edit form
    this._editCancel(workout.id);

    // render change
    this._renderEdit(workout);

    // save to db
    this._setLocalStorage();
  }

  _renderEdit(workout) {
    const workoutDisplay = containerWorkouts.querySelector(
      `[data-id="${workout.id}"]`
    );
    workoutDisplay.querySelector('.workout-value--distance').innerHTML =
      workout.distance;
    workoutDisplay.querySelector('.workout-value--duration').innerHTML =
      workout.duration;

    if (workout.type === 'running') {
      workoutDisplay.querySelector('.workout-value--pace').innerHTML =
        workout.pace;
      workoutDisplay.querySelector('.workout-value--cadence').innerHTML =
        workout.cadence;
    }
    if (workout.type === 'cycling') {
      workoutDisplay.querySelector('.workout-value--speed').innerHTML =
        workout.speed;
      workoutDisplay.querySelector('.workout-value--elevation').innerHTML =
        workout.elevation;
    }
  }

  _containerWorkoutsClickHandler(e) {
    // CONFIRM FORM VALIDATION
    if (e.target.classList.contains('confirm__form__validation')) {
      const formOverlay = form.querySelector('.workout__overlay');
      this._formOverlayDeactivate(formOverlay);
    }
    // Cancel form
    if (e.target.classList.contains('cancel__form')) {
      this._hideFormSmooth();
    }
    // EDIT WORKOUT
    if (e.target.classList.contains('edit__workout')) {
      const toEditId = e.target.closest('.workout').dataset.id;
      this._showEditWorkout(toEditId);
    }

    if (e.target.classList.contains('edit__save')) {
      const toEditId = e.target.closest('.workout').dataset.id;
      this._editSave(toEditId);
    }

    if (e.target.classList.contains('edit__cancel')) {
      const toEditId = e.target.closest('.workout').dataset.id;
      this._editCancel(toEditId);
    }

    if (e.target.classList.contains('confirm__edit__validation')) {
      const toEditId = e.target.closest('.workout').dataset.id;
      this._editOverlayDeactivate(toEditId);
    }
    // END OF EDIT WORKOUT
    // DELETING WORKOUT
    if (e.target.classList.contains('delete__workout')) {
      let targetWorkout = Array.from(
        e.target.closest('.workout').children
      ).find(el => el.classList.contains('workout__overlay'));
      this._workoutOverlayActivate(targetWorkout);
      this._confirmDelete(targetWorkout);
    }
    if (e.target.classList.contains('confirm__delete__btns--yes')) {
      let targetWorkout = Array.from(
        e.target.closest('.workout').children
      ).find(el => el.classList.contains('workout__overlay'));
      this._workoutOverlayDeactivate(targetWorkout);
      // Remove from #workout array
      const toDeleteId = targetWorkout.closest('.workout').dataset.id;
      let workout = this._deleteWorkout(toDeleteId);
      // unrender deleted workout
      targetWorkout.closest('.workout').remove();
      // unrender deleted workout marker
      this._deleteWorkoutMarker(workout);
      // Save to DB
      this._setLocalStorage();
    }
    if (e.target.classList.contains('confirm__delete__btns--no')) {
      let targetWorkout = Array.from(
        e.target.closest('.workout').children
      ).find(el => el.classList.contains('workout__overlay'));
      this._workoutOverlayDeactivate(targetWorkout);
    }
    // END OF DELETING WORKOUT
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;
    this._moveToPopup(workoutEl);
  }

  _moveToPopup(workoutEl) {
    const workout = this.#workouts.find(
      work => work.id == workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = data;
    this.#workouts.forEach(workout => this._renderWorkout(workout));
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  view() {
    console.log(this.#workouts);
  }
}

class Workout {
  id = Date.now();
  #date = new Date();
  constructor(coords, distance, duration) {
    this.distance = distance;
    this.duration = duration;
    this.coords = coords;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.#date.getMonth()]
    } ${this.#date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevation) {
    super(coords, distance, duration);
    this.elevation = elevation;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
  }
}

const app = new App();
