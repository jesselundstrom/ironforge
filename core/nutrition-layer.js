// Nutrition Coach — Claude-powered food analysis and coaching
// API key is stored only on the user's device (never synced to cloud).
(function () {
  'use strict';

  let _history = [];
  let _loading = false;
  let _loadingContext = 'text';
  let _streaming = false;
  let _snapshotVersion = 0;
  let _activeHistoryDate = '';
  let _selectedActionId = 'plan_today';

  const NUTRITION_ISLAND_EVENT = 'ironforge:nutrition-updated';
  const NUTRITION_ACTIONS = [
    {
      id: 'plan_today',
      labelKey: 'nutrition.action.plan_today',
      fallbackLabel: 'Build my food plan for today',
      prompt:
        'Build a practical food plan for the rest of today based on my targets, training context, and what I have likely eaten so far. Give a simple meal-by-meal plan.',
      responseHint:
        'Give a structured meal-by-meal plan with bullet points. This response can be longer than usual.',
    },
    {
      id: 'next_meal',
      labelKey: 'nutrition.action.next_meal',
      fallbackLabel: 'What should I eat next?',
      prompt:
        'Recommend the best next meal or snack for today based on my targets, training context, and what I have eaten so far. Keep it practical.',
      responseHint:
        'Keep it to 2-3 sentences — one clear recommendation with estimated macros.',
    },
    {
      id: 'review_today',
      labelKey: 'nutrition.action.review_today',
      fallbackLabel: 'Review today so far',
      prompt:
        'Review my nutrition so far today. Summarize what looks good, what is missing, and the clearest next step. Always include protein progress vs target — flag if I am falling behind and suggest quick protein sources if needed.',
      responseHint:
        'Summarize in 3-5 sentences. Always include protein progress vs target.',
    },
  ];

  function hasNutritionIslandMount() {
    return !!document.getElementById('nutrition-react-root');
  }

  function isNutritionIslandActive() {
    return window.__IRONFORGE_NUTRITION_ISLAND_MOUNTED__ === true;
  }

  function notifyNutritionIsland() {
    if (!hasNutritionIslandMount()) return;
    _snapshotVersion++;
    window.dispatchEvent(new CustomEvent(NUTRITION_ISLAND_EVENT));
  }

  function getNutritionReactSnapshot() {
    _ensureTodayHistoryLoaded();
    var hasApiKey = !!getNutritionApiKey();
    var loadingText = _loading
      ? _loadingContext === 'photo'
        ? tr('nutrition.loading.analyzing', 'Analyzing your meal...')
        : tr('nutrition.loading.thinking', 'Thinking...')
      : '';
    return {
      values: {
        hasApiKey: hasApiKey,
        loading: {
          visible: _loading,
          text: loadingText,
        },
        selectedActionId: _selectedActionId,
        actions: NUTRITION_ACTIONS.map(_getNutritionActionSnapshot),
        contextBanner: hasApiKey ? _getNutritionContextBannerSnapshot() : null,
        todayCard: hasApiKey ? _getNutritionTodayCardSnapshot() : null,
        messagesState: !hasApiKey
          ? 'setup'
          : !_history.length
            ? 'empty'
            : 'thread',
        messages: hasApiKey ? _getNutritionMessagesSnapshot() : [],
        showCorrectionInput: hasApiKey ? _shouldShowCorrectionInput() : false,
        scrollVersion: _snapshotVersion,
      },
    };
  }

  window.__IRONFORGE_NUTRITION_ISLAND_EVENT__ = NUTRITION_ISLAND_EVENT;
  window.getNutritionReactSnapshot = getNutritionReactSnapshot;
  window.notifyNutritionIsland = notifyNutritionIsland;
  window.setSelectedNutritionAction = setSelectedNutritionAction;

  // ─── Storage keys ────────────────────────────────────────────────────────────

  function _todaySessionDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function _todayStartTimestamp() {
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return todayStart.getTime();
  }

  function _legacyHistoryKey() {
    return currentUser
      ? 'ic_nutrition_history::' + currentUser.id
      : 'ic_nutrition_history';
  }

  function _historyKey(dateStamp) {
    var stamp = dateStamp || _todaySessionDate();
    return currentUser
      ? 'ic_nutrition_day::' + currentUser.id + '::' + stamp
      : 'ic_nutrition_day::' + stamp;
  }

  function _apiKeyStorageKey() {
    return 'ic_nutrition_key';
  }

  function _getActionById(actionId) {
    for (var i = 0; i < NUTRITION_ACTIONS.length; i++) {
      if (NUTRITION_ACTIONS[i].id === actionId) return NUTRITION_ACTIONS[i];
    }
    return NUTRITION_ACTIONS[0];
  }

  function _getSelectedAction() {
    return _getActionById(_selectedActionId);
  }

  function _getActionLabel(action) {
    return tr(action.labelKey, action.fallbackLabel);
  }

  function setSelectedNutritionAction(actionId) {
    _selectedActionId = _getActionById(actionId).id;
    if (!isNutritionIslandActive()) {
      _renderComposerControls();
    }
    notifyNutritionIsland();
  }

  function _getNutritionActionSnapshot(action) {
    return {
      id: action.id,
      labelKey: action.labelKey,
      fallbackLabel: action.fallbackLabel,
      selected: action.id === _selectedActionId,
    };
  }

  function _getNutritionContextBannerSnapshot() {
    var bm = (typeof profile !== 'undefined' && profile.bodyMetrics) || {};
    var parts = [];
    var goalKeys = {
      lose_fat: 'nutrition.goal.lose_fat',
      gain_muscle: 'nutrition.goal.gain_muscle',
      recomp: 'nutrition.goal.recomp',
      maintain: 'nutrition.goal.maintain',
    };
    var goalFallbacks = {
      lose_fat: 'fat loss',
      gain_muscle: 'muscle gain',
      recomp: 'recomp',
      maintain: 'maintain',
    };
    if (bm.weight) parts.push(bm.weight + ' kg');
    if (bm.bodyGoal && goalKeys[bm.bodyGoal]) {
      parts.push(tr(goalKeys[bm.bodyGoal], goalFallbacks[bm.bodyGoal]));
    }
    var targets = _calculateTargets();
    if (targets) parts.push(targets.calories + ' kcal/day');

    if (parts.length) {
      return {
        kind: 'personalized',
        text: tr('nutrition.banner.personalized', 'Personalised'),
        details: parts.join(', '),
      };
    }

    return {
      kind: 'setup_body',
      text: tr(
        'nutrition.banner.setup_body',
        'Set up your body profile for personalised advice'
      ),
      linkText: tr('nutrition.banner.settings_link', 'Settings'),
    };
  }

  function _normalizeNutritionNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    var parsed = parseFloat(String(value).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
  }

  function _normalizeStructuredMacroGroup(rawGroup) {
    if (!rawGroup || typeof rawGroup !== 'object') return null;
    var next = {};
    var calories = _normalizeNutritionNumber(rawGroup.calories);
    var protein = _normalizeNutritionNumber(rawGroup.protein_g);
    var carbs = _normalizeNutritionNumber(rawGroup.carbs_g);
    var fat = _normalizeNutritionNumber(rawGroup.fat_g);
    if (calories !== null) next.calories = calories;
    if (protein !== null) next.protein_g = protein;
    if (carbs !== null) next.carbs_g = carbs;
    if (fat !== null) next.fat_g = fat;
    return Object.keys(next).length ? next : null;
  }

  function _normalizeRemainingTodayGroup(rawGroup) {
    if (!rawGroup || typeof rawGroup !== 'object') return null;
    var next = {};
    var calories = _normalizeNutritionNumber(rawGroup.calories);
    var protein = _normalizeNutritionNumber(rawGroup.protein_g);
    if (calories !== null) next.calories = calories;
    if (protein !== null) next.protein_g = protein;
    return Object.keys(next).length ? next : null;
  }

  function _normalizeNutritionTags(rawTags) {
    if (!Array.isArray(rawTags)) return [];
    return rawTags
      .map(function (tag) {
        return String(tag || '').trim().slice(0, 40);
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  function _normalizeStructuredNutritionResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'object') return null;
    var displayMarkdown = String(rawResponse.display_markdown || '').trim();
    var estimatedMacros = _normalizeStructuredMacroGroup(
      rawResponse.estimated_macros
    );
    var remainingToday = _normalizeRemainingTodayGroup(
      rawResponse.remaining_today
    );
    var tags = _normalizeNutritionTags(rawResponse.tags);
    if (!displayMarkdown) return null;
    return {
      display_markdown: displayMarkdown,
      estimated_macros: estimatedMacros,
      remaining_today: remainingToday,
      tags: tags,
    };
  }

  function _parseStructuredNutritionResponse(rawText) {
    var text = String(rawText || '').trim();
    if (!text) return null;

    function tryParse(candidate) {
      if (!candidate) return null;
      try {
        return JSON.parse(candidate);
      } catch (_) {
        return null;
      }
    }

    var parsed = tryParse(text);
    if (!parsed) {
      var fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
      if (fenceMatch) parsed = tryParse(fenceMatch[1].trim());
    }
    if (!parsed) {
      var firstBrace = text.indexOf('{');
      var lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = tryParse(text.slice(firstBrace, lastBrace + 1));
      }
    }

    return _normalizeStructuredNutritionResponse(parsed);
  }

  function _normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var next = { ...entry };
    next.role = next.role === 'assistant' ? 'assistant' : 'user';
    next.text = String(next.text || '');
    if (next.promptText !== undefined) {
      next.promptText = String(next.promptText || '');
    }
    if (next.rawText !== undefined) {
      next.rawText = String(next.rawText || '');
    }
    var structured = _normalizeStructuredNutritionResponse(next.structured);
    if (structured) next.structured = structured;
    else delete next.structured;
    return next;
  }

  function _getStructuredMessageMacros(structured) {
    var estimated = structured && structured.estimated_macros;
    if (!estimated || typeof estimated !== 'object') return null;
    var next = {};
    if (estimated.calories !== null && estimated.calories !== undefined) {
      next.calories = estimated.calories;
    }
    if (estimated.protein_g !== null && estimated.protein_g !== undefined) {
      next.protein = estimated.protein_g;
    }
    if (estimated.carbs_g !== null && estimated.carbs_g !== undefined) {
      next.carbs = estimated.carbs_g;
    }
    if (estimated.fat_g !== null && estimated.fat_g !== undefined) {
      next.fat = estimated.fat_g;
    }
    return Object.keys(next).length ? next : null;
  }

  function _getAssistantMessageMacros(msg) {
    if (!msg || msg.role !== 'assistant' || msg.isError) return null;
    return _getStructuredMessageMacros(msg.structured) || _extractMacros(msg.text);
  }

  function _getTodayTrackedMacroTotals() {
    _ensureTodayHistoryLoaded();
    var ts = _todayStartTimestamp();
    var totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    var mealCount = 0;

    for (var i = 0; i < _history.length; i++) {
      var msg = _history[i];
      if (
        msg.role !== 'assistant' ||
        msg.isError ||
        msg.actionId !== 'analyze_photo' ||
        !msg.timestamp ||
        msg.timestamp < ts
      ) {
        continue;
      }
      var macros = _getAssistantMessageMacros(msg);
      if (!macros) continue;
      mealCount++;
      if (macros.calories !== undefined) {
        totals.calories += parseFloat(macros.calories) || 0;
      }
      if (macros.protein !== undefined) {
        totals.protein += parseFloat(macros.protein) || 0;
      }
      if (macros.carbs !== undefined) {
        totals.carbs += parseFloat(macros.carbs) || 0;
      }
      if (macros.fat !== undefined) {
        totals.fat += parseFloat(macros.fat) || 0;
      }
    }

    return { totals: totals, mealCount: mealCount };
  }

  function _getNutritionTodayCardSnapshot() {
    var tracked = _getTodayTrackedMacroTotals();
    var totals = tracked.totals;
    if (!tracked.mealCount) return null;

    var targets = _calculateTargets();
    return {
      calories: {
        value: Math.round(totals.calories),
        target: targets ? targets.calories : null,
        progress: targets
          ? Math.min(100, Math.round((totals.calories / targets.calories) * 100))
          : 0,
      },
      protein: {
        value: Math.round(totals.protein),
        target: targets ? targets.protein : null,
        progress: targets
          ? Math.min(100, Math.round((totals.protein / targets.protein) * 100))
          : 0,
      },
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
    };
  }

  function _getNutritionMessageSnapshot(msg, idx) {
    if (msg.role === 'user') {
      if (msg.imageDataUrl) {
        return {
          id: msg.id || 'nutrition-user-photo-' + idx,
          kind: 'photo',
          imageDataUrl: msg.imageDataUrl,
        };
      }
      return {
        id: msg.id || 'nutrition-user-action-' + idx,
        kind: 'action',
        text: msg.text || '',
      };
    }

    var isLast = idx === _history.length - 1;
    var isStreaming = isLast && _streaming;
    var macros =
      !msg.isError && !isStreaming ? _getAssistantMessageMacros(msg) : null;
    var modelTag = msg.model
      ? ' · ' +
        msg.model
          .replace(/^claude-/, '')
          .replace(/-\d{8}$/, '')
          .replace(/-\d+$/, '')
      : '';

    return {
      id: msg.id || 'nutrition-coach-' + idx,
      kind: 'coach',
      text: msg.text || '',
      isError: msg.isError === true,
      isStreaming: isStreaming,
      macros: macros,
      timestamp: _formatTimestamp(msg.timestamp),
      modelTag: modelTag,
    };
  }

  function _getNutritionMessagesSnapshot() {
    _ensureTodayHistoryLoaded();
    return _history.map(_getNutritionMessageSnapshot);
  }

  // Show correction input after a food photo analysis response so the user
  // can correct misidentified foods without it cluttering the normal flow.
  function _shouldShowCorrectionInput() {
    _ensureTodayHistoryLoaded();
    if (!_history.length) return false;
    // Walk backwards: find the last assistant message, check if it followed a photo entry
    for (var i = _history.length - 1; i >= 0; i--) {
      if (_history[i].role === 'assistant' && !_history[i].isError) {
        // Check the user message before it
        var prev = _history[i - 1];
        return !!(prev && prev.role === 'user' && prev.imageDataUrl);
      }
    }
    return false;
  }

  function _ensureTodayHistoryLoaded() {
    var today = _todaySessionDate();
    if (_activeHistoryDate === today) return;
    _loadHistory();
  }

  // ─── API key management ───────────────────────────────────────────────────────

  function getNutritionApiKey() {
    return localStorage.getItem(_apiKeyStorageKey()) || '';
  }

  function saveNutritionApiKey(nextValue) {
    const inp = document.getElementById('nutrition-api-key-input');
    const val =
      typeof nextValue === 'string'
        ? nextValue.trim()
        : inp
          ? inp.value.trim()
          : '';
    if (val) {
      localStorage.setItem(_apiKeyStorageKey(), val);
      showToast(
        tr('settings.claude_api_key.saved', 'API key saved'),
        'var(--green)'
      );
    } else {
      localStorage.removeItem(_apiKeyStorageKey());
      showToast(
        tr('settings.claude_api_key.cleared', 'API key removed'),
        'var(--muted)'
      );
    }
    if (typeof window.notifySettingsAccountIsland === 'function') {
      window.notifySettingsAccountIsland();
    }
    if (typeof window.initNutritionPage === 'function') {
      window.initNutritionPage();
    }
    notifyNutritionIsland();
  }

  // ─── History management ───────────────────────────────────────────────────────

  function _loadLegacyTodayHistory() {
    try {
      const raw = localStorage.getItem(_legacyHistoryKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const todayTs = _todayStartTimestamp();
      return parsed
        .filter(function (msg) {
          return msg && msg.timestamp && msg.timestamp >= todayTs;
        })
        .map(_normalizeHistoryEntry)
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function _loadHistory() {
    _activeHistoryDate = _todaySessionDate();
    try {
      const raw = localStorage.getItem(_historyKey());
      if (raw) {
        _history = (JSON.parse(raw) || [])
          .map(_normalizeHistoryEntry)
          .filter(Boolean);
        return;
      }
      _history = _loadLegacyTodayHistory();
      if (_history.length) {
        _saveHistory();
      }
    } catch (_) {
      _history = [];
    }
  }

  function _saveHistory() {
    _activeHistoryDate = _todaySessionDate();
    // Keep last 60 messages to avoid localStorage overflow
    if (_history.length > 60) {
      _history = _history.slice(-60);
    }
    try {
      localStorage.setItem(_historyKey(), JSON.stringify(_history));
    } catch (_) {}
  }

  function _clearHistory() {
    _history = [];
    _activeHistoryDate = _todaySessionDate();
    try {
      localStorage.removeItem(_historyKey());
    } catch (_) {}
  }

  // ─── Image compression ────────────────────────────────────────────────────────

  function _compressImage(dataUrl, maxPx, quality) {
    maxPx = maxPx || 1024;
    quality = quality || 0.82;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width,
          h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w > h) {
            h = Math.round((h * maxPx) / w);
            w = maxPx;
          } else {
            w = Math.round((w * maxPx) / h);
            h = maxPx;
          }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () {
        resolve(dataUrl); // fall back to original
      };
      img.src = dataUrl;
    });
  }

  // ─── Training context builder ─────────────────────────────────────────────────
  // Reads globally available app data and returns a text block that is injected
  // into the Claude system prompt so advice is personalised to the user.

  function _formatRelativeDayLabel(dateInput) {
    var ts = new Date(dateInput).getTime();
    if (!Number.isFinite(ts)) return null;
    var daysAgo = Math.round((Date.now() - ts) / 86400000);
    if (daysAgo <= 0) return 'today';
    if (daysAgo === 1) return 'yesterday';
    return daysAgo + ' days ago';
  }

  function _buildSportContextLines() {
    if (
      typeof schedule === 'undefined' ||
      !schedule.sportName ||
      !schedule.sportDays ||
      !schedule.sportDays.length
    ) {
      return [];
    }

    var now = new Date();
    var todayDow = now.getDay();
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var sportDays = schedule.sportDays
      .filter(function (d) {
        return Number.isInteger(d) && d >= 0 && d <= 6;
      })
      .sort(function (a, b) {
        return a - b;
      });
    if (!sportDays.length) return [];

    var sportDayStr = sportDays
      .map(function (d) {
        return dayNames[d];
      })
      .join(', ');
    var sportName = schedule.sportName;
    var lines = [
      'Today: ' + dayNames[todayDow],
      'Sport: ' +
        sportName +
        ' on ' +
        sportDayStr +
        ' (' +
        (schedule.sportIntensity || 'hard') +
        ' intensity' +
        (schedule.sportLegsHeavy ? ', leg-heavy' : '') +
        ')',
      'Scheduled sport today: ' + (sportDays.includes(todayDow) ? 'yes' : 'no'),
    ];

    var nextSportDay = null;
    var daysUntilNext = null;
    for (var offset = 1; offset <= 7; offset++) {
      var dow = (todayDow + offset) % 7;
      if (!sportDays.includes(dow)) continue;
      nextSportDay = dayNames[dow];
      daysUntilNext = offset;
      break;
    }
    if (nextSportDay) {
      lines.push(
        'Next scheduled sport: ' +
          nextSportDay +
          (daysUntilNext === 1 ? ' (tomorrow)' : ' (in ' + daysUntilNext + ' days)')
      );
    }

    if (typeof workouts === 'undefined' || !workouts.length) return lines;

    var recentSport = workouts
      .filter(function (w) {
        return w && (w.type === 'sport' || w.type === 'hockey');
      })
      .sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      })[0];

    if (!recentSport) return lines;

    var when = _formatRelativeDayLabel(recentSport.date);
    var sportParts = [];
    if (when) sportParts.push(when);
    var durationMin = Math.round((parseFloat(recentSport.duration) || 0) / 60);
    if (durationMin > 0) sportParts.push(durationMin + ' min');
    if (recentSport.rpe) sportParts.push('RPE ' + recentSport.rpe);
    if (recentSport.subtype === 'extra') sportParts.push('extra session');
    lines.push(
      'Most recent sport session: ' +
        (sportParts.length ? sportParts.join(', ') : 'logged')
    );

    return lines;
  }

  function _buildCoachingContext() {
    try {
      var prefs =
        typeof normalizeTrainingPreferences === 'function'
          ? normalizeTrainingPreferences(profile || {})
          : ((profile && profile.preferences) || {});
      var coaching =
        typeof normalizeCoachingProfile === 'function'
          ? normalizeCoachingProfile(profile || {})
          : ((profile && profile.coaching) || {});
      var planningContext =
        typeof buildPlanningContext === 'function'
          ? buildPlanningContext({})
          : null;
      var decision =
        typeof getTodayTrainingDecision === 'function'
          ? getTodayTrainingDecision(planningContext || {})
          : null;

      var snapshot = {};
      if (decision && decision.action) {
        snapshot.today_training_recommendation = decision.action;
      }
      if (
        decision &&
        Array.isArray(decision.restrictionFlags) &&
        decision.restrictionFlags.length
      ) {
        snapshot.restriction_flags = decision.restrictionFlags.slice(0, 4);
      }
      if (
        planningContext &&
        Number.isFinite(parseInt(planningContext.recoveryScore, 10))
      ) {
        snapshot.recovery_score = parseInt(planningContext.recoveryScore, 10);
      }
      if (
        planningContext &&
        Number.isFinite(parseInt(planningContext.sessionsRemaining, 10))
      ) {
        snapshot.sessions_remaining_this_week = parseInt(
          planningContext.sessionsRemaining,
          10
        );
      }

      var timeBudget =
        (decision && parseInt(decision.timeBudgetMinutes, 10)) ||
        parseInt(planningContext && planningContext.timeBudgetMinutes, 10) ||
        parseInt(prefs.sessionMinutes, 10);
      if (Number.isFinite(timeBudget) && timeBudget > 0) {
        snapshot.time_budget_minutes = timeBudget;
      }
      if (coaching && coaching.guidanceMode) {
        snapshot.guidance_mode = coaching.guidanceMode;
      }
      if (coaching && coaching.experienceLevel) {
        snapshot.experience_level = coaching.experienceLevel;
      }
      if (coaching && coaching.sportProfile) {
        snapshot.in_season = coaching.sportProfile.inSeason === true;
      }
      if (Number.isFinite(parseInt(prefs.sessionMinutes, 10))) {
        snapshot.session_minutes = parseInt(prefs.sessionMinutes, 10);
      }
      if (prefs && prefs.equipmentAccess) {
        snapshot.equipment_access = prefs.equipmentAccess;
      }
      if (prefs && prefs.notes) {
        snapshot.user_notes = String(prefs.notes).trim().slice(0, 240);
      }

      return Object.keys(snapshot).length
        ? 'Daily coaching snapshot: ' + JSON.stringify(snapshot)
        : '';
    } catch (_) {
      return '';
    }
  }

  function _buildTrainingContext() {
    var lines = [];

    // Body metrics
    var bm = (typeof profile !== 'undefined' && profile.bodyMetrics) || {};
    if (bm.sex) lines.push('Sex: ' + (bm.sex === 'male' ? 'Male' : 'Female'));
    var bodyParts = [];
    if (bm.weight) bodyParts.push('weight ' + bm.weight + ' kg');
    if (bm.height) bodyParts.push('height ' + bm.height + ' cm');
    if (bm.age) bodyParts.push('age ' + bm.age);
    if (bodyParts.length) lines.push('Body: ' + bodyParts.join(', '));
    if (bm.activityLevel) {
      var activityLabels = {
        sedentary: 'Sedentary (desk job, little exercise)',
        light: 'Lightly active (light exercise 1-3 days/week)',
        moderate: 'Active (moderate exercise 3-5 days/week)',
        very_active: 'Very active (hard exercise 6-7 days/week)',
      };
      lines.push(
        'Activity level: ' +
          (activityLabels[bm.activityLevel] || bm.activityLevel)
      );
    }
    if (bm.targetWeight)
      lines.push('Target weight: ' + bm.targetWeight + ' kg');
    if (bm.bodyGoal) {
      var bodyGoalLabels = {
        lose_fat: 'Lose fat',
        gain_muscle: 'Gain muscle',
        recomp: 'Body recomposition (lose fat and gain muscle simultaneously)',
        maintain: 'Maintain current weight',
      };
      lines.push('Body goal: ' + (bodyGoalLabels[bm.bodyGoal] || bm.bodyGoal));
    }

    // Training preferences
    if (typeof profile !== 'undefined' && profile.preferences) {
      var prefs = profile.preferences;
      var trainingGoalLabels = {
        strength: 'Strength',
        hypertrophy: 'Hypertrophy (muscle growth)',
        general_fitness: 'General fitness',
        sport_support: 'Sport performance support',
      };
      if (prefs.goal)
        lines.push(
          'Training goal: ' + (trainingGoalLabels[prefs.goal] || prefs.goal)
        );
      if (prefs.trainingDaysPerWeek)
        lines.push('Trains: ' + prefs.trainingDaysPerWeek + ' days/week');
    }

    // Current program and block
    if (typeof getActiveProgram === 'function') {
      try {
        var prog = getActiveProgram();
        var state = getActiveProgramState();
        if (prog && prog.name) {
          var programLine = 'Program: ' + prog.name;
          if (state.week) programLine += ', Week ' + state.week;
          if (typeof prog.getBlockInfo === 'function') {
            var blockInfo = prog.getBlockInfo(state);
            if (blockInfo && blockInfo.name)
              programLine += ' (' + blockInfo.name + ' block)';
          }
          lines.push(programLine);
        }
      } catch (_) {}
    }

    // Recovery status
    if (typeof computeFatigue === 'function') {
      try {
        var fatigue = computeFatigue();
        var recovery = Math.round(100 - fatigue.overall);
        var recoveryLabel =
          recovery >= 80
            ? 'well recovered'
            : recovery >= 60
              ? 'moderate fatigue'
              : 'high fatigue';
        lines.push('Recovery: ' + recovery + '% (' + recoveryLabel + ')');
      } catch (_) {}
    }

    // Sport schedule and today's sport context
    lines = lines.concat(_buildSportContextLines());

    var coachingContext = _buildCoachingContext();
    if (coachingContext) lines.push(coachingContext);

    // Recent workouts (last 2 lifting sessions)
    if (typeof workouts !== 'undefined' && workouts.length) {
      var recentLifts = workouts
        .filter(function (w) {
          return w.type !== 'sport' && w.type !== 'hockey';
        })
        .sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        })
        .slice(0, 2);

      recentLifts.forEach(function (w, i) {
        var label = i === 0 ? 'Last workout' : 'Previous workout';
        var daysAgo = Math.round(
          (Date.now() - new Date(w.date).getTime()) / 86400000
        );
        var when =
          daysAgo === 0
            ? 'today'
            : daysAgo === 1
              ? 'yesterday'
              : daysAgo + ' days ago';

        var exerciseSummary = (w.exercises || [])
          .map(function (ex) {
            var workSets = (ex.sets || []).filter(function (s) {
              return s.done && !s.isWarmup;
            });
            if (!workSets.length) return null;
            var weights = workSets
              .map(function (s) {
                return s.weight;
              })
              .filter(Boolean);
            var maxW = weights.length ? Math.max.apply(null, weights) : null;
            return (
              ex.name +
              (maxW ? ' ' + maxW + 'kg' : '') +
              ' ' +
              workSets.length +
              '×' +
              (workSets[0] && workSets[0].reps)
            );
          })
          .filter(Boolean)
          .slice(0, 4)
          .join(', ');

        var rpeStr = w.rpe ? ' · RPE ' + w.rpe : '';
        lines.push(label + ' (' + when + '): ' + exerciseSummary + rpeStr);
      });
    }

    return lines.join('\n');
  }

  // ─── TDEE & macro targets (Mifflin-St Jeor) ─────────────────────────────────

  var _activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very_active: 1.725,
  };

  function _calculateTargets() {
    var bm = (typeof profile !== 'undefined' && profile.bodyMetrics) || {};
    if (!bm.weight || !bm.height || !bm.age || !bm.sex) return null;

    // Mifflin-St Jeor
    var bmr = 10 * bm.weight + 6.25 * bm.height - 5 * bm.age;
    bmr += bm.sex === 'male' ? 5 : -161;

    var multiplier = _activityMultipliers[bm.activityLevel] || 1.375;
    var tdee = Math.round(bmr * multiplier);

    // Adjust for goal
    var goalAdjust = {
      lose_fat: -500,
      gain_muscle: 300,
      recomp: 0,
      maintain: 0,
    };
    var targetCal = tdee + (goalAdjust[bm.bodyGoal] || 0);

    // Protein: 2g/kg for muscle gain, 2.2g/kg for fat loss (preserve muscle), 1.8g/kg maintain
    var proteinPerKg = {
      lose_fat: 2.2,
      gain_muscle: 2.0,
      recomp: 2.0,
      maintain: 1.8,
    };
    var protein = Math.round(bm.weight * (proteinPerKg[bm.bodyGoal] || 1.8));

    // Fat: ~25-30% of target calories
    var fat = Math.round((targetCal * 0.27) / 9);

    // Carbs: remainder
    var carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
    if (carbs < 0) carbs = 0;

    return {
      tdee: tdee,
      calories: targetCal,
      protein: protein,
      carbs: carbs,
      fat: fat,
    };
  }

  // ─── Today's intake summary ──────────────────────────────────────────────────
  // Sums macros extracted from today's coach responses so the system prompt
  // knows what the user has already eaten.

  function _buildTodayIntakeSummary() {
    var tracked = _getTodayTrackedMacroTotals();
    var totals = tracked.totals;
    var mealCount = tracked.mealCount;

    if (!mealCount) return '';
    return (
      "Today's tracked intake so far: ~" +
      Math.round(totals.calories) +
      ' kcal, ' +
      Math.round(totals.protein) +
      'g protein, ' +
      Math.round(totals.carbs) +
      'g carbs, ' +
      Math.round(totals.fat) +
      'g fat (' +
      mealCount +
      (mealCount === 1 ? ' meal' : ' meals') +
      ' logged today)'
    );
  }

  // ─── Claude API call ──────────────────────────────────────────────────────────

  // Auto-select model: Sonnet for photos (good vision), Haiku for text (fast + cheap)
  function _pickModel(hasImage) {
    return hasImage ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  }

  async function _callClaude(apiMessages, hasImage) {
    const apiKey = getNutritionApiKey();
    if (!apiKey) {
      const err = new Error('no_key');
      throw err;
    }

    const model = _pickModel(hasImage);
    const context = _buildTrainingContext();
    const todayIntake = _buildTodayIntakeSummary();
    const targets = _calculateTargets();
    const targetsStr = targets
      ? 'Daily targets: ' +
        targets.calories +
        ' kcal, ' +
        targets.protein +
        'g protein, ' +
        targets.carbs +
        'g carbs, ' +
        targets.fat +
        'g fat' +
        ' (TDEE ' +
        targets.tdee +
        ' kcal)'
      : '';
    const uiLocale =
      (typeof window.I18N !== 'undefined' && window.I18N.getLanguage()) || 'en';
    const langInstruction =
      uiLocale === 'fi'
        ? 'Always respond in Finnish (Suomi). '
        : 'Always respond in English. ';
    const systemPrompt =
      'You are a concise, motivating nutrition coach for a strength athlete. ' +
      langInstruction +
      'Return EXACTLY one JSON object and nothing else. No code fences, no backticks, and no prose outside the JSON.\n\n' +
      'Required JSON schema:\n' +
      '{"display_markdown":"string","estimated_macros":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0},"remaining_today":{"calories":0,"protein_g":0},"tags":["string"]}\n\n' +
      'RULES:\n' +
      '- Put the full user-facing answer only in display_markdown.\n' +
      '- display_markdown must stay short and polished, and only use simple markdown that our UI supports: short paragraphs, bullets, ##/### headings, and **bold**.\n' +
      '- Do not use tables, HTML, or code fences inside display_markdown.\n' +
      '- Apply any response-format instruction from the user prompt to display_markdown.\n' +
      '- When the user logs food or shares a photo, fill estimated_macros whenever you can.\n' +
      '- When daily targets are available, fill remaining_today with calories and protein left vs target.\n' +
      '- Use metric units (g, kg, kcal). Keep meal suggestions practical - real foods, not exotic ingredients.\n' +
      '- Be direct and encouraging. Celebrate hitting targets, and flag shortfalls matter-of-factly.' +
      (context ? '\n\nUser context:\n' + context : '') +
      (targetsStr ? '\n\n' + targetsStr : '') +
      (todayIntake ? '\n' + todayIntake : '');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 401) {
        throw new Error(
          tr('nutrition.error.auth', 'API key is invalid or expired.')
        );
      }
      if (resp.status === 429) {
        throw new Error(
          tr(
            'nutrition.error.rate_limit',
            'Rate limit reached — wait a moment and try again.'
          )
        );
      }
      if (resp.status >= 500) {
        throw new Error(
          tr(
            'nutrition.error.server',
            'Claude API is temporarily unavailable.'
          )
        );
      }
      const errData = await resp.json().catch(function () {
        return {};
      });
      throw new Error(
        (errData.error && errData.error.message) || 'API error ' + resp.status
      );
    }

    return { response: resp, model: model };
  }

  // ─── Build API messages from history ─────────────────────────────────────────
  // We include the last 10 history entries as context, but strip image data from
  // old entries to keep the request small. Only the current message carries an image.

  function _buildApiMessages(userEntry) {
    // Exclude the last entry — it's the user message we just pushed to _history
    // and we'll re-add it below with the full image payload.
    const contextEntries = _history.slice(-11, -1);
    const apiMessages = contextEntries.map(function (msg) {
      if (msg.role === 'user') {
        // Include image only if it's the most recent user message with an image
        // (for history context we send text only)
        const text =
          msg.promptText || msg.text || (msg.imageDataUrl ? '[food photo]' : '');
        return { role: 'user', content: text };
      }
      return { role: 'assistant', content: msg.text || '' };
    });

    // Build the new user message with optional image
    const content = [];
    if (userEntry.imageDataUrl) {
      const parts = userEntry.imageDataUrl.split(',');
      const base64 = parts[1] || '';
      const mediaMatch = parts[0] && parts[0].match(/data:([^;]+)/);
      const mediaType = (mediaMatch && mediaMatch[1]) || 'image/jpeg';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });
    }
    if (userEntry.promptText) {
      content.push({ type: 'text', text: userEntry.promptText });
    }
    if (!content.length) {
      content.push({
        type: 'text',
        text: tr(
          'nutrition.default_prompt',
          'What can you tell me about this food?'
        ),
      });
    }

    apiMessages.push({ role: 'user', content: content });
    return apiMessages;
  }

  // ─── SSE stream parser ───────────────────────────────────────────────────────

  async function _readStream(resp, onChunk) {
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    while (true) {
      var result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });

      var lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line.startsWith('data: ')) continue;
        var json = line.slice(6);
        if (json === '[DONE]') return;
        try {
          var evt = JSON.parse(json);
          if (
            evt.type === 'content_block_delta' &&
            evt.delta &&
            evt.delta.text
          ) {
            onChunk(evt.delta.text);
          }
        } catch (_) {}
      }
    }
  }

  // ─── Send a message ───────────────────────────────────────────────────────────

  async function sendNutritionMessage(payload) {
    if (_loading) return;
    _ensureTodayHistoryLoaded();

    // Offline check
    if (!navigator.onLine) {
      _history.push({
        id: Date.now() + '-a',
        role: 'assistant',
        text: tr(
          'nutrition.error.offline',
          'You are offline. Connect to the internet and try again.'
        ),
        timestamp: Date.now(),
        isError: true,
      });
      _saveHistory();
      _renderMessages();
      _scrollToBottom();
      return;
    }

    var userEntry = {
      id: Date.now() + '-u',
      role: 'user',
      text: payload.displayText || '',
      promptText: payload.promptText || payload.displayText || '',
      imageDataUrl: payload.imageDataUrl || null,
      actionId: payload.actionId || null,
      timestamp: Date.now(),
    };
    _history.push(userEntry);
    _saveHistory();
    _renderMessages();
    _scrollToBottom();
    _setLoading(true, userEntry.imageDataUrl ? 'photo' : 'text');

    var hasImage = !!userEntry.imageDataUrl;
    var apiMessages = _buildApiMessages(userEntry);

    try {
      var result = await _callClaude(apiMessages, hasImage);
      var rawText = '';
      await _readStream(result.response, function (chunk) {
        rawText += chunk;
      });

      _streaming = false;
      var structured = _parseStructuredNutritionResponse(rawText);
      var assistantEntry = {
        id: Date.now() + '-a',
        role: 'assistant',
        text: structured
          ? structured.display_markdown
          : String(rawText || '').trim(),
        timestamp: Date.now(),
        model: result.model,
        actionId: userEntry.actionId || null,
      };
      if (structured) {
        assistantEntry.structured = structured;
        assistantEntry.rawText = String(rawText || '');
      } else if (rawText) {
        assistantEntry.rawText = String(rawText);
      }
      if (!assistantEntry.text) {
        assistantEntry.text = tr(
          'nutrition.error.api',
          'Something went wrong. Check your API key and try again.'
        );
        assistantEntry.isError = true;
      }
      _history.push(assistantEntry);
      _setLoading(false);
      _saveHistory();
    } catch (e) {
      _setLoading(false);
      _streaming = false;
      var isNoKey = e.message === 'no_key';
      var errorText;
      if (isNoKey) {
        errorText = tr(
          'nutrition.error.no_key',
          'Please add your Claude API key in Settings \u2192 Account to use the Nutrition Coach.'
        );
      } else {
        // Specific errors (auth, rate limit, server) already have translated messages
        errorText = e.message || tr(
          'nutrition.error.api',
          'Something went wrong. Check your API key and try again.'
        );
      }
      _history.push({
        id: Date.now() + '-a',
        role: 'assistant',
        text: errorText,
        timestamp: Date.now(),
        isError: true,
      });
      _saveHistory();
    }

    _renderMessages();
    _scrollToBottom();
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  function _setLoading(loading, context) {
    _loading = loading;
    _loadingContext = context || 'text';
    var el = document.getElementById('nutrition-loading');
    if (el) el.style.display = loading ? 'flex' : 'none';
    var btn = document.getElementById('nutrition-send-btn');
    if (btn) btn.disabled = loading;
    if (loading) {
      var textEl = document.getElementById('nutrition-loading-text');
      if (textEl) {
        var msg =
          context === 'photo'
            ? tr('nutrition.loading.analyzing', 'Analyzing your meal...')
            : tr('nutrition.loading.thinking', 'Thinking...');
        textEl.textContent = msg;
      }
    }
    notifyNutritionIsland();
  }

  function _scrollToBottom(instant) {
    var el = document.getElementById('nutrition-messages');
    if (el)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: instant ? 'auto' : 'smooth',
      });
  }


  // Lightweight markdown renderer for coach responses.
  // Handles: ## headings, **bold**, `code`, bullet/numbered lists, paragraphs.
  function _formatText(text) {
    var lines = text.split('\n');
    var html = [];
    var inUl = false,
      inOl = false;

    function closeLists() {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = escapeHtml(raw);

      // Headings
      if (/^###\s/.test(raw)) {
        closeLists();
        html.push(
          '<div class="nc-h3">' +
            _inlineFormat(line.replace(/^###\s+/, '')) +
            '</div>'
        );
        continue;
      }
      if (/^##\s/.test(raw)) {
        closeLists();
        html.push(
          '<div class="nc-h2">' +
            _inlineFormat(line.replace(/^##\s+/, '')) +
            '</div>'
        );
        continue;
      }
      if (/^#\s/.test(raw)) {
        closeLists();
        html.push(
          '<div class="nc-h2">' +
            _inlineFormat(line.replace(/^#\s+/, '')) +
            '</div>'
        );
        continue;
      }

      // Unordered list
      if (/^[-*]\s/.test(raw)) {
        if (inOl) {
          html.push('</ol>');
          inOl = false;
        }
        if (!inUl) {
          html.push('<ul class="nc-list">');
          inUl = true;
        }
        html.push(
          '<li>' + _inlineFormat(line.replace(/^[-*]\s+/, '')) + '</li>'
        );
        continue;
      }

      // Ordered list
      if (/^\d+[.)]\s/.test(raw)) {
        if (inUl) {
          html.push('</ul>');
          inUl = false;
        }
        if (!inOl) {
          html.push('<ol class="nc-list">');
          inOl = true;
        }
        html.push(
          '<li>' + _inlineFormat(line.replace(/^\d+[.)]\s+/, '')) + '</li>'
        );
        continue;
      }

      // Empty line = paragraph break
      if (raw.trim() === '') {
        closeLists();
        html.push('<div class="nc-break"></div>');
        continue;
      }

      // Normal paragraph line
      closeLists();
      html.push('<p class="nc-p">' + _inlineFormat(line) + '</p>');
    }
    closeLists();
    return html.join('');
  }

  // Inline formatting: bold, code, italic
  function _inlineFormat(escaped) {
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<span class="nc-code">$1</span>');
  }

  // ─── Macro extraction ──────────────────────────────────────────────────
  // Pulls structured macro data from Claude's text response when present.

  function _extractMacros(text) {
    var result = {};
    var calMatch =
      text.match(/(?:calories|kcal|cal)[:\s~]*(\d[\d,.]*)/i) ||
      text.match(/(\d[\d,.]*)\s*(?:kcal|calories|cal)\b/i);
    var proMatch = text.match(/protein[:\s~]*(\d[\d,.]*)\s*g/i);
    var carbMatch = text.match(/carb(?:s|ohydrate)?[:\s~]*(\d[\d,.]*)\s*g/i);
    var fatMatch = text.match(/fat[:\s~]*(\d[\d,.]*)\s*g/i);

    if (calMatch) result.calories = calMatch[1].replace(',', '');
    if (proMatch) result.protein = proMatch[1].replace(',', '');
    if (carbMatch) result.carbs = carbMatch[1].replace(',', '');
    if (fatMatch) result.fat = fatMatch[1].replace(',', '');

    // Only return if we found at least 2 values (meaningful data)
    return Object.keys(result).length >= 2 ? result : null;
  }

  function _renderMacroCard(macros) {
    var items = [];
    if (macros.calories)
      items.push(
        '<div class="nutrition-macro-item nc-macro-cal">' +
          '<div class="nutrition-macro-value">' +
          escapeHtml(macros.calories) +
          '</div>' +
          '<div class="nutrition-macro-label">kcal</div></div>'
      );
    if (macros.protein)
      items.push(
        '<div class="nutrition-macro-item nc-macro-pro">' +
          '<div class="nutrition-macro-value">' +
          escapeHtml(macros.protein) +
          'g</div>' +
          '<div class="nutrition-macro-label">' +
          tr('nutrition.macro.protein', 'Protein') +
          '</div></div>'
      );
    if (macros.carbs)
      items.push(
        '<div class="nutrition-macro-item nc-macro-carb">' +
          '<div class="nutrition-macro-value">' +
          escapeHtml(macros.carbs) +
          'g</div>' +
          '<div class="nutrition-macro-label">' +
          tr('nutrition.macro.carbs', 'Carbs') +
          '</div></div>'
      );
    if (macros.fat)
      items.push(
        '<div class="nutrition-macro-item nc-macro-fat">' +
          '<div class="nutrition-macro-value">' +
          escapeHtml(macros.fat) +
          'g</div>' +
          '<div class="nutrition-macro-label">' +
          tr('nutrition.macro.fat', 'Fat') +
          '</div></div>'
      );
    return '<div class="nutrition-macro-card">' + items.join('') + '</div>';
  }

  // ─── Timestamp formatting ─────────────────────────────────────────────

  function _formatTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var hm =
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0');
    var sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return hm;
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return tr('nutrition.time.yesterday', 'Yesterday') + ' ' + hm;
    }
    return d.getDate() + '.' + (d.getMonth() + 1) + '. ' + hm;
  }

  // ─── Coach avatar SVG fragment ────────────────────────────────────────

  var _avatarHtml =
    '<div class="nutrition-coach-avatar">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14">' +
    '<path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8"/>' +
    '<path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z"/>' +
    '</svg></div>';

  // ─── Render messages ──────────────────────────────────────────────────

  function _updateMetaStack() {
    if (isNutritionIslandActive()) {
      notifyNutritionIsland();
      return;
    }
    _ensureTodayHistoryLoaded();
    var metaStack = document.getElementById('nutrition-meta-stack');
    if (!metaStack) return;
    if (!getNutritionApiKey()) {
      metaStack.innerHTML = '';
      return;
    }

    var html = _renderContextBanner();
    var todayHtml = _renderTodayCard();
    if (todayHtml) html += todayHtml;
    metaStack.innerHTML = html;
    if (window.I18N && I18N.applyTranslations)
      I18N.applyTranslations(metaStack);
  }

  function _renderMessages() {
    _ensureTodayHistoryLoaded();
    if (isNutritionIslandActive()) {
      notifyNutritionIsland();
      return;
    }
    var container = document.getElementById('nutrition-messages');
    if (!container) return;
    var inputBar = document.querySelector('.nutrition-input-bar');
    var composer = document.querySelector('.nutrition-composer');
    container.classList.remove(
      'nutrition-messages-setup',
      'nutrition-messages-empty',
      'nutrition-messages-thread'
    );
    _updateMetaStack();

    // If no API key, show setup card
    if (!getNutritionApiKey()) {
      if (inputBar) inputBar.classList.add('nc-hidden');
      if (composer) composer.classList.add('nc-hidden');
      container.classList.add('nutrition-messages-setup');
      container.innerHTML = _renderSetupCard();
      if (window.I18N && I18N.applyTranslations)
        I18N.applyTranslations(container);
      notifyNutritionIsland();
      return;
    }

    // Show input bar
    if (inputBar) inputBar.classList.remove('nc-hidden');
    if (composer) composer.classList.remove('nc-hidden');
    _renderComposerControls();

    // Empty state with quick prompts
    if (!_history.length) {
      container.classList.add('nutrition-messages-empty');
      container.innerHTML = _renderEmptyState();
      if (window.I18N && I18N.applyTranslations)
        I18N.applyTranslations(container);
      notifyNutritionIsland();
      return;
    }

    // Render conversation
    container.classList.add('nutrition-messages-thread');
    container.innerHTML = _history
      .map(function (msg, idx) {
        var time =
          '<div class="nutrition-msg-time">' +
          _formatTimestamp(msg.timestamp) +
          '</div>';
        if (msg.role === 'user') {
          // Photo messages: show thumbnail with action label
          if (msg.imageDataUrl) {
            return (
              '<div class="nutrition-msg-photo-tag">' +
              '<img class="nutrition-msg-photo-thumb" src="' +
              escapeHtml(msg.imageDataUrl) +
              '" alt="">' +
              '</div>'
            );
          }
          // Action-only messages: compact centered tag
          var actionLabel = msg.text || '';
          return (
            '<div class="nutrition-msg-action-tag">' +
            '<span>' + escapeHtml(actionLabel) + '</span>' +
            '</div>'
          );
        }
        // Coach message with avatar + macro card
        var isLast = idx === _history.length - 1;
        var isStreaming = isLast && _streaming;
        var macros =
          !msg.isError && !isStreaming ? _getAssistantMessageMacros(msg) : null;
        var macroHtml = macros ? _renderMacroCard(macros) : '';
        var retryHtml = msg.isError
          ? '<div class="nutrition-msg-text"><button class="nutrition-retry-btn" onclick="retryLastNutritionMessage()" data-i18n="nutrition.retry">' +
            tr('nutrition.retry', 'Try again') +
            '</button></div>'
          : '';
        var modelTag = msg.model
          ? ' · ' +
            msg.model
              .replace(/^claude-/, '')
              .replace(/-\d{8}$/, '')
              .replace(/-\d+$/, '')
          : '';
        var cursorHtml = isStreaming ? '<span class="nc-cursor"></span>' : '';
        return (
          '<div class="nutrition-msg nutrition-msg-coach' +
          (msg.isError ? ' nutrition-msg-error' : '') +
          '">' +
          _avatarHtml +
          '<div class="nutrition-msg-body">' +
          macroHtml +
          '<div class="nutrition-msg-text">' +
          _formatText(msg.text || '') +
          cursorHtml +
          '</div>' +
          retryHtml +
          '<div class="nutrition-msg-time">' +
          _formatTimestamp(msg.timestamp) +
          modelTag +
          '</div>' +
          '</div></div>'
        );
      })
      .join('');
    notifyNutritionIsland();
  }

  // ─── Setup card (no API key) ──────────────────────────────────────────

  function _renderSetupCard() {
    return (
      '<div class="nutrition-setup-card">' +
      '<div class="card-title" data-i18n="nutrition.setup.title">Setup Required</div>' +
      '<div class="nutrition-setup-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="24" height="24">' +
      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
      '</svg></div>' +
      '<div class="nutrition-setup-desc" data-i18n="nutrition.setup.body">' +
      'Add your Claude API key to use the Nutrition Coach. Your key is stored only on this device.' +
      '</div>' +
      '<div class="account-field">' +
      '<label data-i18n="settings.claude_api_key.label">Claude API Key</label>' +
      '<input type="password" id="nutrition-setup-key-input" placeholder="sk-ant-..." autocomplete="off" spellcheck="false">' +
      '</div>' +
      '<button class="btn btn-primary" type="button" onclick="saveNutritionSetupKey()" data-i18n="nutrition.setup.save">' +
      'Save &amp; Start</button>' +
      '<div class="nutrition-setup-desc" style="margin-top:12px;font-size:12px;" data-i18n="nutrition.setup.help">' +
      'Get your API key at console.anthropic.com</div>' +
      '</div>'
    );
  }

  // Save API key from the in-page setup card
  function saveNutritionSetupKey() {
    var inp = document.getElementById('nutrition-setup-key-input');
    var val = inp ? inp.value.trim() : '';
    if (!val) {
      showToast(tr('nutrition.setup.empty', 'Enter an API key'), 'var(--red)');
      return;
    }
    localStorage.setItem(_apiKeyStorageKey(), val);
    // Also update the Settings input if it exists
    var settingsInp = document.getElementById('nutrition-api-key-input');
    if (settingsInp) settingsInp.value = val;
    if (typeof window.notifySettingsAccountIsland === 'function') {
      window.notifySettingsAccountIsland();
    }
    showToast(
      tr('settings.claude_api_key.saved', 'API key saved'),
      'var(--green)'
    );
    _renderMessages();
    notifyNutritionIsland();
  }

  // ─── Premium empty state ──────────────────────────────────────────────

  function _buildActionRequest(action, imageDataUrl) {
    var label = _getActionLabel(action);

    var promptParts = ['Primary task: ' + label, action.prompt];
    if (action.responseHint) {
      promptParts.push('Response format: ' + action.responseHint);
    }
    if (imageDataUrl) {
      promptParts.push('A food photo is attached.');
    }

    return {
      actionId: action.id,
      displayText: label,
      promptText: promptParts.join('\n\n'),
      imageDataUrl: imageDataUrl || null,
    };
  }

  function _renderActionCard(action) {
    return (
      '<button class="nutrition-prompt-chip nutrition-action-card' +
      (action.id === _selectedActionId ? ' active' : '') +
      '" type="button" data-nc-action="' +
      action.id +
      '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<line x1="5" y1="12" x2="19" y2="12"/>' +
      '<polyline points="12 5 19 12 12 19"/>' +
      '</svg>' +
      '<span data-i18n="' +
      action.labelKey +
      '">' +
      escapeHtml(action.fallbackLabel) +
      '</span>' +
      '</button>'
    );
  }

  function _renderActionGrid() {
    return NUTRITION_ACTIONS.map(_renderActionCard).join('');
  }

  function _renderComposerControls() {
    if (isNutritionIslandActive()) {
      notifyNutritionIsland();
      return;
    }
    var grid = document.getElementById('nutrition-action-grid');
    if (!grid) return;
    grid.innerHTML = _renderActionGrid();
    if (window.I18N && I18N.applyTranslations) {
      I18N.applyTranslations(grid);
    }
  }

  function _renderEmptyState() {
    return (
      '<div class="nutrition-empty">' +
      '<div class="nutrition-empty-kicker" data-i18n="nutrition.empty.kicker">AI NUTRITION COACH</div>' +
      '<div class="nutrition-empty-orb">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">' +
      '<path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8"/>' +
      '<path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z"/>' +
      '</svg></div>' +
      '<div class="nutrition-empty-title" data-i18n="nutrition.empty.title">Your daily nutrition coach</div>' +
      '<div class="nutrition-empty-sub" data-i18n="nutrition.empty.body">' +
      'Pick a guided action below and get personalised nutrition advice for today.</div>' +
      '<div class="nutrition-empty-reset" data-i18n="nutrition.empty.reset">' +
      'Resets automatically each day.</div>' +
      '</div>'
    );
  }

  document.addEventListener('click', function (e) {
    var actionCard = e.target.closest('.nutrition-action-card');
    if (!actionCard) return;
    _selectedActionId =
      actionCard.getAttribute('data-nc-action') || NUTRITION_ACTIONS[0].id;
    _renderComposerControls();
    notifyNutritionIsland();
    submitNutritionMessage(); // one-tap: submit immediately on card click
  });

  // ─── Body metrics context banner ──────────────────────────────────────

  function _renderContextBanner() {
    var bm = (typeof profile !== 'undefined' && profile.bodyMetrics) || {};
    var parts = [];
    if (bm.weight) parts.push(bm.weight + ' kg');
    var goalKeys = {
      lose_fat: 'nutrition.goal.lose_fat',
      gain_muscle: 'nutrition.goal.gain_muscle',
      recomp: 'nutrition.goal.recomp',
      maintain: 'nutrition.goal.maintain',
    };
    var goalFallbacks = {
      lose_fat: 'fat loss',
      gain_muscle: 'muscle gain',
      recomp: 'recomp',
      maintain: 'maintain',
    };
    if (bm.bodyGoal && goalKeys[bm.bodyGoal])
      parts.push(tr(goalKeys[bm.bodyGoal], goalFallbacks[bm.bodyGoal]));

    var targets = _calculateTargets();
    if (targets) parts.push(targets.calories + ' kcal/day');

    if (parts.length) {
      return (
        '<div class="nutrition-context-banner">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '<span>' +
        tr('nutrition.banner.personalized', 'Personalised') +
        ' · ' +
        escapeHtml(parts.join(', ')) +
        '</span>' +
        '</div>'
      );
    }
    return (
      '<div class="nutrition-context-banner">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
      '<span>' +
      tr(
        'nutrition.banner.setup_body',
        'Set up your body profile for personalised advice'
      ) +
      " <a onclick=\"showPage('settings', document.querySelectorAll('.nav-btn')[3])\">" +
      tr('nutrition.banner.settings_link', 'Settings') +
      ' &rarr;</a></span>' +
      '</div>'
    );
  }

  // ─── Today's intake summary card ─────────────────────────────────────

  function _renderTodayCard() {
    var tracked = _getTodayTrackedMacroTotals();
    var totals = tracked.totals;
    if (!tracked.mealCount) return '';

    var targets = _calculateTargets();

    // Calorie headline with target
    var calStr =
      Math.round(totals.calories) +
      (targets ? ' / ' + targets.calories : '') +
      ' kcal';
    var calPct = targets
      ? Math.min(100, Math.round((totals.calories / targets.calories) * 100))
      : 0;
    var calBar = targets
      ? '<div class="nc-today-bar"><div class="nc-today-bar-fill" style="width:' +
        calPct +
        '%"></div></div>'
      : '';

    // Protein bar (most critical for athletes)
    var proPct = targets
      ? Math.min(100, Math.round((totals.protein / targets.protein) * 100))
      : 0;
    var proBar = targets
      ? '<div class="nc-today-bar nc-today-bar-pro"><div class="nc-today-bar-fill nc-today-bar-fill-pro" style="width:' +
        proPct +
        '%"></div></div>'
      : '';

    // Compact macro row
    var macroRow =
      '<div class="nc-today-macros">' +
      '<div class="nc-today-macro nc-macro-pro"><strong>' + Math.round(totals.protein) + 'g</strong> ' + tr('nutrition.macro.protein', 'P') + '</div>' +
      '<div class="nc-today-macro nc-macro-carb"><strong>' + Math.round(totals.carbs) + 'g</strong> ' + tr('nutrition.macro.carbs', 'C') + '</div>' +
      '<div class="nc-today-macro nc-macro-fat"><strong>' + Math.round(totals.fat) + 'g</strong> ' + tr('nutrition.macro.fat', 'F') + '</div>' +
      '</div>';

    return (
      '<div class="nutrition-today-card">' +
      '<div class="nc-today-header">' +
      '<div class="nc-today-label">' + tr('nutrition.today.label', 'Today') + '</div>' +
      '<div class="nc-today-cal"><strong>' + calStr + '</strong></div>' +
      '</div>' +
      calBar +
      proBar +
      macroRow +
      '</div>'
    );
  }


  // ─── Retry last message ───────────────────────────────────────────────

  function retryLastNutritionMessage() {
    // Find the last user message and replay it
    for (var i = _history.length - 1; i >= 0; i--) {
      if (_history[i].role === 'user') {
        var entry = _history[i];
        // Remove the user message and everything after it (error response)
        _history.splice(i);
        _saveHistory();
        _renderMessages();
        sendNutritionMessage({
          actionId: entry.actionId,
          displayText: entry.text,
          promptText: entry.promptText || entry.text,
          imageDataUrl: entry.imageDataUrl,
        });
        return;
      }
    }
  }

  // ─── Photo handling ───────────────────────────────────────────────────────────

  function handleNutritionPhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      _compressImage(e.target.result).then(function (compressed) {
        // Auto-send photo analysis — no extra tap needed
        sendNutritionMessage({
          actionId: 'analyze_photo',
          displayText: tr('nutrition.action.analyze_photo', 'Analyze this food photo'),
          promptText: [
            'Primary task: Analyze this food photo.',
            'Analyze the attached food photo, estimate macros when possible, and explain how this meal fits my goals today.',
            'Response format: Estimate macros first, then 1-2 sentences of coaching. End with remaining calories and protein for today.',
            'A food photo is attached.',
          ].join('\n\n'),
          imageDataUrl: compressed,
        });
      });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // allow re-selecting same file
  }


  // ─── Submit ───────────────────────────────────────────────────────────────────

  function submitNutritionMessage() {
    _ensureTodayHistoryLoaded();
    const action = _getSelectedAction();

    if (!action) return;

    sendNutritionMessage(_buildActionRequest(action, null));
  }

  function submitNutritionTextMessage(text) {
    var trimmed = (text || '').trim();
    if (!trimmed) return;
    _ensureTodayHistoryLoaded();
    sendNutritionMessage({
      actionId: null,
      displayText: trimmed,
      promptText: trimmed,
      imageDataUrl: null,
    });
  }

  // ─── Clear history ────────────────────────────────────────────────────────────

  function clearNutritionHistory() {
    showConfirm(
      tr('nutrition.clear.title', 'Clear conversation'),
      tr(
        'nutrition.clear.body',
        'This will delete your entire nutrition conversation history.'
      ),
      function () {
        _clearHistory();
        _renderMessages();
        notifyNutritionIsland();
      }
    );
  }

  // ─── Page init ────────────────────────────────────────────────────────────────

  function initNutritionPage() {
    _loadHistory();
    _renderMessages();
    _scrollToBottom();
    notifyNutritionIsland();
  }

  // ─── Expose globals ───────────────────────────────────────────────────────────

  window.initNutritionPage = initNutritionPage;
  window.handleNutritionPhoto = handleNutritionPhoto;
  window.submitNutritionMessage = submitNutritionMessage;
  window.submitNutritionTextMessage = submitNutritionTextMessage;
  window.clearNutritionHistory = clearNutritionHistory;
  window.getNutritionApiKey = getNutritionApiKey;
  window.saveNutritionApiKey = saveNutritionApiKey;
  window.saveNutritionSetupKey = saveNutritionSetupKey;
  window.retryLastNutritionMessage = retryLastNutritionMessage;
})();
