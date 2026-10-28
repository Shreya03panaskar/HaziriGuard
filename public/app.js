/**
 * HaziriGuard - Frontend Application Logic
 *
 * Core Principles:
 * - Pure vanilla JavaScript (no frameworks, no external libraries)
 * - Safe DOM manipulation: user-supplied text rendered via textContent / createTextNode ONLY
 * - WCAG AA accessibility: proper keyboard navigation, visible focus, ARIA live region
 * - Full offline resilience (no CDN or external network dependencies)
 */

(function () {
  'use strict';

  // Application State
  const state = {
    settings: { reserve: 3 },
    subjects: [],
    tasks: [],
    subjectMap: {}, // id -> subject
    cardMessages: {}, // subjectId -> { text, typeClass }
    loading: false,
    error: null,
    today: getTodayDateString()
  };

  // DOM Elements
  const el = {
    announcements: document.getElementById('announcements'),
    errorBanner: document.getElementById('error-banner'),
    errorBannerMessage: document.getElementById('error-banner-message'),
    btnRetry: document.getElementById('btn-retry-connection'),
    btnLoadDemo: document.getElementById('btn-load-demo'),
    btnLoadDemoEmpty: document.getElementById('btn-load-demo-empty'),
    btnResetData: document.getElementById('btn-reset-data'),
    summaryStatusIcon: document.getElementById('summary-status-icon'),
    summaryStatusText: document.getElementById('summary-status-text'),
    countDanger: document.getElementById('count-danger'),
    countCareful: document.getElementById('count-careful'),
    countSafe: document.getElementById('count-safe'),
    countTasks: document.getElementById('count-tasks'),
    badgeTaskCount: document.getElementById('badge-task-count'),
    subjectsContainer: document.getElementById('subjects-container'),
    subjectsEmpty: document.getElementById('subjects-empty'),
    tasksList: document.getElementById('tasks-list'),
    tasksEmpty: document.getElementById('tasks-empty'),
    formAddSubject: document.getElementById('form-add-subject'),
    inputSubjectName: document.getElementById('input-subject-name'),
    inputSubjectRequired: document.getElementById('input-subject-required'),
    subjectNameError: document.getElementById('subject-name-error'),
    subjectRequiredError: document.getElementById('subject-required-error'),
    addSubjectGeneralError: document.getElementById('add-subject-general-error'),
    formSettings: document.getElementById('form-settings'),
    inputReserve: document.getElementById('input-reserve'),
    settingsMessage: document.getElementById('settings-message')
  };

  /**
   * Returns current local date as "YYYY-MM-DD"
   */
  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Announces an update to screen readers via aria-live
   */
  function announce(message) {
    if (el.announcements) {
      el.announcements.textContent = '';
      setTimeout(() => {
        el.announcements.textContent = message;
      }, 50);
    }
  }

  /**
   * Helper to construct DOM elements safely without innerHTML.
   * Prevents XSS attacks on user-supplied content.
   */
  function h(tag, attrs = {}, children = []) {
    const element = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
      if (key === 'className') {
        element.className = val;
      } else if (key === 'textContent') {
        element.textContent = val;
      } else if (key.startsWith('on') && typeof val === 'function') {
        element.addEventListener(key.slice(2).toLowerCase(), val);
      } else if (key === 'dataset' && typeof val === 'object') {
        for (const [dKey, dVal] of Object.entries(val)) {
          element.dataset[dKey] = dVal;
        }
      } else if (val !== false && val !== null && val !== undefined) {
        element.setAttribute(key, val);
      }
    }
    for (const child of children) {
      if (child === null || child === undefined) continue;
      if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(String(child)));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    }
    return element;
  }

  /**
   * Status display configuration mapping status to Icon and Label
   */
  const STATUS_CONFIG = {
    Danger: { icon: '⚠️', text: 'Danger', class: 'status-badge-Danger' },
    Careful: { icon: '⚡', text: 'Careful', class: 'status-badge-Careful' },
    Safe: { icon: '🛡️', text: 'Safe', class: 'status-badge-Safe' },
    NoData: { icon: 'ℹ️', text: 'No Data', class: 'status-badge-NoData' }
  };

  /**
   * Creates a status badge element containing both an ICON and TEXT
   */
  function createStatusBadge(status) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.NoData;
    return h('span', { className: `status-badge ${config.class}` }, [
      h('span', { 'aria-hidden': 'true', textContent: config.icon }),
      h('span', { textContent: config.text })
    ]);
  }

  // ==========================================
  // DATA FETCHING & SYNCHRONIZATION
  // ==========================================

  /**
   * Loads both dashboard and tasks concurrently
   */
  async function loadAllData() {
    state.loading = true;
    showErrorBanner(null);

    try {
      const [dashRes, tasksRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/tasks')
      ]);

      if (!dashRes.ok || !tasksRes.ok) {
        throw new Error('Server returned an error response.');
      }

      const dashData = await dashRes.json();
      const tasksData = await tasksRes.json();

      state.settings = dashData.settings || { reserve: 3 };
      state.subjects = dashData.subjects || [];
      state.tasks = Array.isArray(tasksData) ? tasksData : [];

      // Build subject lookup map for quick subject name references
      state.subjectMap = {};
      for (const subj of state.subjects) {
        state.subjectMap[subj.id] = subj;
      }

      renderSummary();
      renderSubjects();
      renderTasks();
      renderSettings();
    } catch (err) {
      state.error = err.message || 'Network error';
      showErrorBanner('Unable to connect to the HaziriGuard server. Please verify your server is running.');
    } finally {
      state.loading = false;
    }
  }

  /**
   * Displays or hides the top error banner
   */
  function showErrorBanner(message) {
    if (message) {
      el.errorBannerMessage.textContent = message;
      el.errorBanner.classList.remove('hidden');
    } else {
      el.errorBanner.classList.add('hidden');
    }
  }

  // ==========================================
  // RENDER METHODS
  // ==========================================

  /**
   * Renders the summary strip at the top
   */
  function renderSummary() {
    let dangerCount = 0;
    let carefulCount = 0;
    let safeCount = 0;

    for (const subj of state.subjects) {
      if (subj.status === 'Danger') dangerCount++;
      else if (subj.status === 'Careful') carefulCount++;
      else if (subj.status === 'Safe') safeCount++;
    }

    const pendingTasks = state.tasks.filter(t => !t.done).length;

    el.countDanger.textContent = dangerCount;
    el.countCareful.textContent = carefulCount;
    el.countSafe.textContent = safeCount;
    el.countTasks.textContent = pendingTasks;
    el.badgeTaskCount.textContent = `${pendingTasks} Pending`;

    // Dynamic banner text based on urgency
    if (state.subjects.length === 0) {
      el.summaryStatusIcon.textContent = '📚';
      el.summaryStatusText.textContent = 'No subjects tracked yet. Add a course or load fictional demo data below.';
    } else if (dangerCount > 0) {
      el.summaryStatusIcon.textContent = '⚠️';
      el.summaryStatusText.textContent = dangerCount === 1
        ? '1 subject needs attention today'
        : `${dangerCount} subjects need attention today`;
    } else if (carefulCount > 0) {
      el.summaryStatusIcon.textContent = '⚡';
      el.summaryStatusText.textContent = carefulCount === 1
        ? 'All subjects above limit, but 1 subject has reached its emergency reserve'
        : `All subjects above limit, but ${carefulCount} subjects are within emergency reserve`;
    } else {
      el.summaryStatusIcon.textContent = '🛡️';
      el.summaryStatusText.textContent = 'All subjects safe with healthy emergency reserves';
    }
  }

  /**
   * Renders all subject cards in the grid
   */
  function renderSubjects() {
    el.subjectsContainer.textContent = '';

    if (state.subjects.length === 0) {
      el.subjectsEmpty.classList.remove('hidden');
      return;
    }

    el.subjectsEmpty.classList.add('hidden');

    for (const subject of state.subjects) {
      const card = createSubjectCard(subject);
      el.subjectsContainer.appendChild(card);
    }
  }

  /**
   * Builds an individual Subject Card
   */
  function createSubjectCard(subject) {
    const card = h('article', {
      className: `subject-card status-${subject.status}`,
      dataset: { subjectId: subject.id },
      'aria-labelledby': `subject-heading-${subject.id}`
    });

    // 1. Header: Name & Status Badge
    const header = h('div', { className: 'card-header' }, [
      h('div', {}, [
        h('h3', {
          id: `subject-heading-${subject.id}`,
          className: 'card-subject-name',
          textContent: subject.name
        }),
        h('div', {
          className: 'card-attendance-ratio',
          textContent: subject.total === 0
            ? 'No classes logged yet'
            : `${subject.attended} attended of ${subject.total} classes held (Required: ${subject.required}%)`
        })
      ]),
      createStatusBadge(subject.status)
    ]);

    // 2. Big Percentage Display
    const pctText = subject.percentage !== null ? `${subject.percentage}%` : '—';
    const pctArea = h('div', { className: 'percentage-display-area' }, [
      h('span', {
        className: `big-percentage color-${subject.status}`,
        textContent: pctText
      }),
      h('span', {
        className: 'percentage-threshold-note',
        textContent: `Threshold: ${subject.required}% minimum`
      })
    ]);

    // 3. Progress Bar with Visible Required Threshold Marker
    const pctValue = subject.percentage !== null ? Math.min(100, Math.max(0, subject.percentage)) : 0;
    const progressTrack = h('div', {
      className: 'progress-track',
      role: 'progressbar',
      'aria-valuenow': subject.percentage !== null ? subject.percentage : 0,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-label': `${subject.name} attendance: ${pctText}, required: ${subject.required}%`
    }, [
      // Current fill
      h('div', {
        className: `progress-fill fill-${subject.status}`,
        style: `width: ${pctValue}%`
      }),
      // Required percentage vertical marker
      h('div', {
        className: 'progress-marker',
        style: `left: ${subject.required}%`
      }),
      // Marker label
      h('span', {
        className: 'progress-marker-label',
        style: `left: ${subject.required}%`,
        textContent: `${subject.required}% req`
      })
    ]);

    const progressContainer = h('div', { className: 'progress-container' }, [progressTrack]);

    // 4. Three Facts Grid: Safety buffer, Recovery needed, Pending catch-ups
    const factsGrid = h('div', { className: 'card-facts-grid' }, [
      h('div', { className: 'fact-item' }, [
        h('span', { className: 'fact-label', textContent: 'Safety Buffer' }),
        h('span', {
          className: `fact-value ${subject.spareBuffer > 0 ? 'fact-highlight-safe' : ''}`,
          textContent: subject.total === 0 ? '—' : `${subject.spareBuffer} classes spare`
        })
      ]),
      h('div', { className: 'fact-item' }, [
        h('span', { className: 'fact-label', textContent: 'Classes to recover' }),
        h('span', {
          className: `fact-value ${subject.recoveryNeeded > 0 ? 'fact-highlight-danger' : ''}`,
          textContent: subject.recoveryNeeded > 0
            ? `${subject.recoveryNeeded} consecutive`
            : 'None (Above limit)'
        })
      ]),
      h('div', { className: 'fact-item' }, [
        h('span', { className: 'fact-label', textContent: 'Pending Catch-ups' }),
        h('span', {
          className: 'fact-value',
          textContent: `${subject.pendingCatchUps} tasks`
        })
      ])
    ]);

    // 5. Quick Log Class Controls
    const logSection = createLogClassSection(subject);

    // 6. What-If Simulator Section
    const whatIfSection = createWhatIfSection(subject);

    card.appendChild(header);
    card.appendChild(pctArea);
    card.appendChild(progressContainer);
    card.appendChild(factsGrid);
    card.appendChild(logSection);
    card.appendChild(whatIfSection);

    return card;
  }

  /**
   * Creates the "Log Class" action section for a subject card
   */
  function createLogClassSection(subject) {
    const section = h('div', { className: 'card-log-section' });

    const title = h('h4', { className: 'log-section-title', textContent: 'Log a class attendance:' });

    const dateInput = h('input', {
      type: 'date',
      className: 'log-date-input',
      value: state.today,
      'aria-label': `Class date for ${subject.name}`
    });

    const noteInput = h('input', {
      type: 'text',
      className: 'log-note-input',
      placeholder: 'Topic / Note (optional)',
      maxLength: 100,
      'aria-label': `Optional topic or note for ${subject.name}`
    });

    const btnAttended = h('button', {
      type: 'button',
      className: 'btn btn-attended btn-sm',
      textContent: 'Attended'
    });

    const btnMissed = h('button', {
      type: 'button',
      className: 'btn btn-missed btn-sm',
      textContent: 'Missed'
    });

    const activeMsg = state.cardMessages[subject.id];
    const actionMessage = h('div', {
      className: `card-action-message ${activeMsg ? activeMsg.typeClass : 'hidden'}`,
      role: 'status',
      'aria-live': 'polite',
      textContent: activeMsg ? activeMsg.text : ''
    });

    // Logging Handlers
    async function submitClass(status) {
      const dateVal = dateInput.value;
      if (!dateVal) {
        setCardMessage(subject.id, 'Please select a valid date.', 'msg-catchup');
        await loadAllData();
        return;
      }

      btnAttended.disabled = true;
      btnMissed.disabled = true;

      try {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: subject.id,
            date: dateVal,
            status: status,
            note: noteInput.value.trim()
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to log class.');
        }

        const data = await res.json();
        noteInput.value = '';

        if (status === 'missed') {
          setCardMessage(
            subject.id,
            `Missed class logged. Catch-up task created due on ${data.task.due}!`,
            'msg-catchup'
          );
          announce(`Missed class logged for ${subject.name}. Catch-up task created due on ${data.task.due}.`);
        } else {
          setCardMessage(subject.id, `Attended class logged for ${subject.name}!`, 'msg-success');
          announce(`Attended class logged for ${subject.name}.`);
        }

        // Refresh state
        await loadAllData();
      } catch (err) {
        setCardMessage(subject.id, err.message, 'msg-catchup');
        await loadAllData();
      } finally {
        btnAttended.disabled = false;
        btnMissed.disabled = false;
      }
    }

    btnAttended.addEventListener('click', () => submitClass('attended'));
    btnMissed.addEventListener('click', () => submitClass('missed'));

    const controlsRow = h('div', { className: 'log-controls-row' }, [
      dateInput,
      noteInput,
      btnAttended,
      btnMissed
    ]);

    section.appendChild(title);
    section.appendChild(controlsRow);
    section.appendChild(actionMessage);

    return section;
  }

  function setCardMessage(subjectId, text, typeClass) {
    state.cardMessages[subjectId] = { text, typeClass };
    setTimeout(() => {
      if (state.cardMessages[subjectId] && state.cardMessages[subjectId].text === text) {
        delete state.cardMessages[subjectId];
        const cardMsgEl = document.querySelector(`.subject-card[data-subject-id="${subjectId}"] .card-action-message`);
        if (cardMsgEl) cardMsgEl.classList.add('hidden');
      }
    }, 7000);
  }

  /**
   * Creates the What-If Simulator section for a subject card
   */
  function createWhatIfSection(subject) {
    const section = h('div', { className: 'card-whatif-section' });

    const header = h('div', { className: 'whatif-header' }, [
      h('span', { 'aria-hidden': 'true', textContent: '🔮' }),
      h('span', { textContent: 'What-If Attendance Simulator' })
    ]);

    const inputId = `whatif-input-${subject.id}`;
    const numberInput = h('input', {
      type: 'number',
      id: inputId,
      className: 'whatif-number-input',
      min: 0,
      max: 10,
      step: 1,
      value: 0,
      'aria-label': `Simulate missing more classes for ${subject.name}`
    });

    const inputRow = h('div', { className: 'whatif-input-row' }, [
      h('label', { htmlFor: inputId, className: 'whatif-input-label', textContent: 'If I miss' }),
      numberInput,
      h('span', { className: 'whatif-input-label', textContent: 'more classes:' })
    ]);

    const resultsBox = h('div', {
      className: 'whatif-results',
      'aria-live': 'polite'
    }, [
      h('span', { textContent: 'Change the number of missed classes to simulate the effect on your buffer.' })
    ]);

    const quote = h('p', {
      className: 'whatif-quote',
      textContent: '“Missed classes also mean missed content.”'
    });

    // Debounced API call to /api/whatif
    let debounceTimer = null;

    async function runWhatIf() {
      const missCount = parseInt(numberInput.value, 10);
      if (isNaN(missCount) || missCount < 0 || missCount > 10) {
        resultsBox.textContent = '';
        resultsBox.appendChild(
          h('span', { className: 'form-error', textContent: 'Please enter a number between 0 and 10.' })
        );
        return;
      }

      if (missCount === 0) {
        resultsBox.textContent = '';
        resultsBox.appendChild(
          h('span', { textContent: `Baseline: ${subject.percentage !== null ? subject.percentage + '%' : 'No Data'}, Status: ` })
        );
        resultsBox.appendChild(createStatusBadge(subject.status));
        return;
      }

      try {
        const res = await fetch(`/api/whatif?subjectId=${subject.id}&miss=${missCount}`);
        if (!res.ok) throw new Error('Simulation failed');
        const data = await res.json();

        resultsBox.textContent = '';

        const dropLine = h('div', {}, [
          h('strong', { textContent: `Attendance drops to ${data.percentage}% ` }),
          h('span', { textContent: `(Status: ` }),
          createStatusBadge(data.status),
          h('span', { textContent: `)` })
        ]);

        const impactLine = h('div', { style: 'margin-top: 0.35rem;' });
        if (data.status === 'Danger') {
          impactLine.appendChild(
            h('span', {
              className: 'fact-highlight-danger',
              textContent: `⚠️ Drops below required threshold! You would need to attend ${data.recoveryNeeded} consecutive classes to recover.`
            })
          );
        } else if (data.status === 'Careful') {
          impactLine.appendChild(
            h('span', {
              style: 'color: var(--careful-text); font-weight: 600;',
              textContent: `⚡ Emergency reserve reached. You would have 0 spare classes left.`
            })
          );
        } else {
          impactLine.appendChild(
            h('span', {
              className: 'fact-highlight-safe',
              textContent: `🛡️ Remains safe with ${data.spareBuffer} classes spare buffer.`
            })
          );
        }

        resultsBox.appendChild(dropLine);
        resultsBox.appendChild(impactLine);
      } catch (err) {
        resultsBox.textContent = 'Could not calculate simulation.';
      }
    }

    numberInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runWhatIf, 200);
    });

    section.appendChild(header);
    section.appendChild(inputRow);
    section.appendChild(resultsBox);
    section.appendChild(quote);

    return section;
  }

  /**
   * Renders the Catch-up Planner tasks
   */
  function renderTasks() {
    el.tasksList.textContent = '';

    if (state.tasks.length === 0) {
      el.tasksEmpty.classList.remove('hidden');
      return;
    }

    el.tasksEmpty.classList.add('hidden');

    // Sort: uncompleted first, then by due date
    const sortedTasks = [...state.tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.due.localeCompare(b.due);
    });

    for (const task of sortedTasks) {
      const subject = state.subjectMap[task.subjectId];
      const subjectName = subject ? subject.name : 'Class Catch-up';

      const isOverdue = !task.done && task.due < state.today;

      const checkboxId = `task-chk-${task.id}`;
      const checkbox = h('input', {
        type: 'checkbox',
        id: checkboxId,
        className: 'task-checkbox',
        checked: task.done,
        'aria-label': `Mark task '${task.note}' as completed`
      });

      checkbox.addEventListener('change', async () => {
        try {
          const res = await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ done: checkbox.checked })
          });

          if (!res.ok) throw new Error('Failed to update task.');

          announce(checkbox.checked ? `Task marked completed: ${task.note}` : `Task marked uncompleted: ${task.note}`);
          await loadAllData();
        } catch (err) {
          checkbox.checked = !checkbox.checked;
          announce('Error updating task.');
        }
      });

      const details = h('div', { className: 'task-details' }, [
        h('span', { className: 'task-subject', textContent: subjectName }),
        h('label', { htmlFor: checkboxId, className: 'task-note', textContent: task.note }),
        h('div', { className: 'task-meta' }, [
          h('span', { textContent: `Due: ${task.due}` }),
          isOverdue
            ? h('span', { className: 'badge-overdue' }, [
                h('span', { 'aria-hidden': 'true', textContent: '⚠️' }),
                h('span', { textContent: 'Overdue' })
              ])
            : null
        ])
      ]);

      const item = h('div', { className: `task-item ${task.done ? 'task-done' : ''}` }, [
        checkbox,
        details
      ]);

      el.tasksList.appendChild(item);
    }
  }

  /**
   * Renders the settings values
   */
  function renderSettings() {
    if (el.inputReserve) {
      el.inputReserve.value = state.settings.reserve;
    }
  }

  // ==========================================
  // EVENT LISTENERS & FORM SUBMISSIONS
  // ==========================================

  /**
   * Add Subject Form Submission
   */
  el.formAddSubject.addEventListener('submit', async (e) => {
    e.preventDefault();

    el.subjectNameError.classList.add('hidden');
    el.subjectRequiredError.classList.add('hidden');
    el.addSubjectGeneralError.classList.add('hidden');

    const name = el.inputSubjectName.value.trim();
    const required = parseInt(el.inputSubjectRequired.value, 10);

    let hasClientError = false;

    if (!name || name.length < 1 || name.length > 60) {
      el.subjectNameError.textContent = 'Subject name must be between 1 and 60 characters.';
      el.subjectNameError.classList.remove('hidden');
      hasClientError = true;
    }

    if (isNaN(required) || required < 1 || required > 99) {
      el.subjectRequiredError.textContent = 'Required percentage must be a whole number between 1 and 99.';
      el.subjectRequiredError.classList.remove('hidden');
      hasClientError = true;
    }

    if (hasClientError) return;

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, required })
      });

      const data = await res.json();

      if (!res.ok) {
        el.addSubjectGeneralError.textContent = data.error || 'Failed to add subject.';
        el.addSubjectGeneralError.classList.remove('hidden');
        announce(data.error || 'Failed to add subject.');
        return;
      }

      el.inputSubjectName.value = '';
      el.inputSubjectRequired.value = '75';
      announce(`Subject ${data.name} added successfully.`);
      await loadAllData();
    } catch (err) {
      el.addSubjectGeneralError.textContent = 'Network error. Could not connect to server.';
      el.addSubjectGeneralError.classList.remove('hidden');
    }
  });

  /**
   * Save Settings Form Submission
   */
  el.formSettings.addEventListener('submit', async (e) => {
    e.preventDefault();

    const reserve = parseInt(el.inputReserve.value, 10);
    if (isNaN(reserve) || reserve < 0 || reserve > 10) {
      el.settingsMessage.textContent = 'Reserve must be a whole number between 0 and 10.';
      el.settingsMessage.className = 'form-message form-error';
      el.settingsMessage.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reserve })
      });

      if (!res.ok) throw new Error('Failed to update settings.');

      el.settingsMessage.textContent = `Saved! Emergency reserve set to ${reserve} classes.`;
      el.settingsMessage.className = 'form-message msg-success';
      el.settingsMessage.classList.remove('hidden');
      setTimeout(() => el.settingsMessage.classList.add('hidden'), 4000);

      announce(`Emergency reserve updated to ${reserve} classes.`);
      await loadAllData();
    } catch (err) {
      el.settingsMessage.textContent = 'Failed to save settings.';
      el.settingsMessage.className = 'form-message form-error';
      el.settingsMessage.classList.remove('hidden');
    }
  });

  /**
   * Load Demo Data
   */
  async function loadDemoData() {
    try {
      const res = await fetch('/api/demo/load', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load demo data.');
      announce('Fictional demo data loaded successfully.');
      await loadAllData();
    } catch (err) {
      alert('Could not load demo data. Check server connection.');
    }
  }

  el.btnLoadDemo.addEventListener('click', loadDemoData);
  if (el.btnLoadDemoEmpty) {
    el.btnLoadDemoEmpty.addEventListener('click', loadDemoData);
  }

  /**
   * Reset All Data with Confirmation Dialog
   */
  el.btnResetData.addEventListener('click', async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset all attendance records, subjects, and tasks? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed.');
      announce('All database records have been reset.');
      await loadAllData();
    } catch (err) {
      alert('Could not reset data. Check server connection.');
    }
  });

  /**
   * Retry button on error banner
   */
  el.btnRetry.addEventListener('click', () => {
    loadAllData();
  });

  // Initialize application on load
  document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
  });

})();
