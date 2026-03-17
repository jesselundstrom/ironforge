// Nutrition Coach — Claude-powered food analysis and coaching
// API key is stored only on the user's device (never synced to cloud).
(function () {
  'use strict';

  let _history = [];
  let _loading = false;
  let _streaming = false;
  let _pendingImage = null; // base64 data URL of selected photo

  // ─── Storage keys ────────────────────────────────────────────────────────────

  function _historyKey() {
    return currentUser ? 'ic_nutrition_history::' + currentUser.id : 'ic_nutrition_history';
  }

  function _apiKeyStorageKey() {
    return 'ic_nutrition_key';
  }

  // ─── API key management ───────────────────────────────────────────────────────

  function getNutritionApiKey() {
    return localStorage.getItem(_apiKeyStorageKey()) || '';
  }

  function saveNutritionApiKey() {
    const inp = document.getElementById('nutrition-api-key-input');
    const val = inp ? inp.value.trim() : '';
    if (val) {
      localStorage.setItem(_apiKeyStorageKey(), val);
      showToast(tr('settings.claude_api_key.saved', 'API key saved'), 'var(--green)');
    } else {
      localStorage.removeItem(_apiKeyStorageKey());
      showToast(tr('settings.claude_api_key.cleared', 'API key removed'), 'var(--muted)');
    }
  }

  // ─── History management ───────────────────────────────────────────────────────

  function _loadHistory() {
    try {
      const raw = localStorage.getItem(_historyKey());
      _history = raw ? JSON.parse(raw) : [];
    } catch (_) {
      _history = [];
    }
  }

  function _saveHistory() {
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
        var w = img.width, h = img.height;
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
      lines.push('Activity level: ' + (activityLabels[bm.activityLevel] || bm.activityLevel));
    }
    if (bm.targetWeight) lines.push('Target weight: ' + bm.targetWeight + ' kg');
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
      if (prefs.goal) lines.push('Training goal: ' + (trainingGoalLabels[prefs.goal] || prefs.goal));
      if (prefs.trainingDaysPerWeek) lines.push('Trains: ' + prefs.trainingDaysPerWeek + ' days/week');
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
            if (blockInfo && blockInfo.name) programLine += ' (' + blockInfo.name + ' block)';
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
          recovery >= 80 ? 'well recovered' : recovery >= 60 ? 'moderate fatigue' : 'high fatigue';
        lines.push('Recovery: ' + recovery + '% (' + recoveryLabel + ')');
      } catch (_) {}
    }

    // Sport schedule
    if (
      typeof schedule !== 'undefined' &&
      schedule.sportName &&
      schedule.sportDays &&
      schedule.sportDays.length
    ) {
      var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      var sportDayStr = schedule.sportDays.map(function (d) { return dayNames[d]; }).join(', ');
      lines.push(
        'Sport: ' +
          schedule.sportName +
          ' on ' +
          sportDayStr +
          ' (' +
          (schedule.sportIntensity || 'hard') +
          ' intensity' +
          (schedule.sportLegsHeavy ? ', leg-heavy' : '') +
          ')'
      );
    }

    // Recent workouts (last 2 lifting sessions)
    if (typeof workouts !== 'undefined' && workouts.length) {
      var recentLifts = workouts
        .filter(function (w) { return w.type !== 'sport' && w.type !== 'hockey'; })
        .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
        .slice(0, 2);

      recentLifts.forEach(function (w, i) {
        var label = i === 0 ? 'Last workout' : 'Previous workout';
        var daysAgo = Math.round((Date.now() - new Date(w.date).getTime()) / 86400000);
        var when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + ' days ago';

        var exerciseSummary = (w.exercises || [])
          .map(function (ex) {
            var workSets = (ex.sets || []).filter(function (s) { return s.done && !s.isWarmup; });
            if (!workSets.length) return null;
            var weights = workSets.map(function (s) { return s.weight; }).filter(Boolean);
            var maxW = weights.length ? Math.max.apply(null, weights) : null;
            return ex.name + (maxW ? ' ' + maxW + 'kg' : '') + ' ' + workSets.length + '×' + (workSets[0] && workSets[0].reps);
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
    var goalAdjust = { lose_fat: -500, gain_muscle: 300, recomp: 0, maintain: 0 };
    var targetCal = tdee + (goalAdjust[bm.bodyGoal] || 0);

    // Protein: 2g/kg for muscle gain, 2.2g/kg for fat loss (preserve muscle), 1.8g/kg maintain
    var proteinPerKg = { lose_fat: 2.2, gain_muscle: 2.0, recomp: 2.0, maintain: 1.8 };
    var protein = Math.round(bm.weight * (proteinPerKg[bm.bodyGoal] || 1.8));

    // Fat: ~25-30% of target calories
    var fat = Math.round((targetCal * 0.27) / 9);

    // Carbs: remainder
    var carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
    if (carbs < 0) carbs = 0;

    return { tdee: tdee, calories: targetCal, protein: protein, carbs: carbs, fat: fat };
  }

  // ─── Today's intake summary ──────────────────────────────────────────────────
  // Sums macros extracted from today's coach responses so the system prompt
  // knows what the user has already eaten.

  function _buildTodayIntakeSummary() {
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    var ts = todayStart.getTime();

    var totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    var mealCount = 0;

    for (var i = 0; i < _history.length; i++) {
      var msg = _history[i];
      if (msg.role !== 'assistant' || msg.isError || !msg.timestamp || msg.timestamp < ts) continue;
      var macros = _extractMacros(msg.text || '');
      if (!macros) continue;
      mealCount++;
      if (macros.calories) totals.calories += parseFloat(macros.calories) || 0;
      if (macros.protein) totals.protein += parseFloat(macros.protein) || 0;
      if (macros.carbs) totals.carbs += parseFloat(macros.carbs) || 0;
      if (macros.fat) totals.fat += parseFloat(macros.fat) || 0;
    }

    if (!mealCount) return '';
    return (
      "Today's tracked intake so far: ~" +
      Math.round(totals.calories) + ' kcal, ' +
      Math.round(totals.protein) + 'g protein, ' +
      Math.round(totals.carbs) + 'g carbs, ' +
      Math.round(totals.fat) + 'g fat (' +
      mealCount + (mealCount === 1 ? ' meal' : ' meals') + ' logged today)'
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
      ? 'Daily targets: ' + targets.calories + ' kcal, ' +
        targets.protein + 'g protein, ' + targets.carbs + 'g carbs, ' + targets.fat + 'g fat' +
        ' (TDEE ' + targets.tdee + ' kcal)'
      : '';
    const systemPrompt =
      'You are a knowledgeable nutrition coach for a strength athlete who trains with weights. ' +
      'When the user shares food photos or asks questions, analyze the food, estimate macros ' +
      '(protein, carbs, fat, calories) when possible, and give practical coaching advice. ' +
      'Keep responses concise and actionable. Use metric units. Be supportive and direct.' +
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

  function _buildApiMessages(newImageDataUrl, newText) {
    // Exclude the last entry — it's the user message we just pushed to _history
    // and we'll re-add it below with the full image payload.
    const contextEntries = _history.slice(-11, -1);
    const apiMessages = contextEntries.map(function (msg) {
      if (msg.role === 'user') {
        // Include image only if it's the most recent user message with an image
        // (for history context we send text only)
        const text =
          msg.text || (msg.imageDataUrl ? '[food photo]' : '');
        return { role: 'user', content: text };
      }
      return { role: 'assistant', content: msg.text || '' };
    });

    // Build the new user message with optional image
    const content = [];
    if (newImageDataUrl) {
      const parts = newImageDataUrl.split(',');
      const base64 = parts[1] || '';
      const mediaMatch = parts[0] && parts[0].match(/data:([^;]+)/);
      const mediaType = (mediaMatch && mediaMatch[1]) || 'image/jpeg';
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });
    }
    if (newText) {
      content.push({ type: 'text', text: newText });
    }
    if (!content.length) {
      content.push({
        type: 'text',
        text: tr('nutrition.default_prompt', 'What can you tell me about this food?'),
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
          if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
            onChunk(evt.delta.text);
          }
        } catch (_) {}
      }
    }
  }

  // ─── Send a message ───────────────────────────────────────────────────────────

  async function sendNutritionMessage(text, imageDataUrl) {
    if (_loading) return;

    // Offline check
    if (!navigator.onLine) {
      _history.push({
        id: Date.now() + '-a',
        role: 'assistant',
        text: tr('nutrition.error.offline', 'You are offline. Connect to the internet and try again.'),
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
      text: text || '',
      imageDataUrl: imageDataUrl || null,
      timestamp: Date.now(),
    };
    _history.push(userEntry);
    _saveHistory();
    _renderMessages();
    _scrollToBottom();
    _setLoading(true, imageDataUrl ? 'photo' : 'text');

    var hasImage = !!imageDataUrl;
    var apiMessages = _buildApiMessages(imageDataUrl, text);

    try {
      var result = await _callClaude(apiMessages, hasImage);
      var assistantEntry = {
        id: Date.now() + '-a',
        role: 'assistant',
        text: '',
        timestamp: Date.now(),
        model: result.model,
      };
      _history.push(assistantEntry);
      _setLoading(false);
      _streaming = true;
      _renderMessages();
      _scrollToBottom();

      var _renderPending = false;
      await _readStream(result.response, function (chunk) {
        assistantEntry.text += chunk;
        if (!_renderPending) {
          _renderPending = true;
          requestAnimationFrame(function () {
            _renderPending = false;
            _renderMessages();
            _scrollToBottom();
          });
        }
      });

      _streaming = false;
      _saveHistory();
    } catch (e) {
      _setLoading(false);
      _streaming = false;
      var isNoKey = e.message === 'no_key';
      _history.push({
        id: Date.now() + '-a',
        role: 'assistant',
        text: isNoKey
          ? tr(
              'nutrition.error.no_key',
              'Please add your Claude API key in Settings \u2192 Account to use the Nutrition Coach.'
            )
          : tr('nutrition.error.api', 'Something went wrong. Check your API key and try again.') +
            (e.message && !isNoKey ? ' (' + e.message + ')' : ''),
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
    var el = document.getElementById('nutrition-loading');
    if (el) el.style.display = loading ? 'flex' : 'none';
    var btn = document.getElementById('nutrition-send-btn');
    if (btn) btn.disabled = loading;
    if (loading) {
      var textEl = document.getElementById('nutrition-loading-text');
      if (textEl) {
        var msg = context === 'photo'
          ? tr('nutrition.loading.analyzing', 'Analyzing your meal...')
          : tr('nutrition.loading.thinking', 'Thinking...');
        textEl.textContent = msg;
      }
    }
  }

  function _scrollToBottom() {
    const content = document.querySelector('.content');
    if (content) content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
  }

  // Lightweight markdown renderer for coach responses.
  // Handles: ## headings, **bold**, `code`, bullet/numbered lists, paragraphs.
  function _formatText(text) {
    var lines = text.split('\n');
    var html = [];
    var inUl = false, inOl = false;

    function closeLists() {
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (inOl) { html.push('</ol>'); inOl = false; }
    }

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = escapeHtml(raw);

      // Headings
      if (/^###\s/.test(raw)) {
        closeLists();
        html.push('<div class="nc-h3">' + _inlineFormat(line.replace(/^###\s+/, '')) + '</div>');
        continue;
      }
      if (/^##\s/.test(raw)) {
        closeLists();
        html.push('<div class="nc-h2">' + _inlineFormat(line.replace(/^##\s+/, '')) + '</div>');
        continue;
      }
      if (/^#\s/.test(raw)) {
        closeLists();
        html.push('<div class="nc-h2">' + _inlineFormat(line.replace(/^#\s+/, '')) + '</div>');
        continue;
      }

      // Unordered list
      if (/^[-*]\s/.test(raw)) {
        if (inOl) { html.push('</ol>'); inOl = false; }
        if (!inUl) { html.push('<ul class="nc-list">'); inUl = true; }
        html.push('<li>' + _inlineFormat(line.replace(/^[-*]\s+/, '')) + '</li>');
        continue;
      }

      // Ordered list
      if (/^\d+[.)]\s/.test(raw)) {
        if (inUl) { html.push('</ul>'); inUl = false; }
        if (!inOl) { html.push('<ol class="nc-list">'); inOl = true; }
        html.push('<li>' + _inlineFormat(line.replace(/^\d+[.)]\s+/, '')) + '</li>');
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
    var calMatch = text.match(/(?:calories|kcal|cal)[:\s~]*(\d[\d,.]*)/i) ||
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
    if (macros.calories) items.push(
      '<div class="nutrition-macro-item nc-macro-cal">' +
      '<div class="nutrition-macro-value">' + escapeHtml(macros.calories) + '</div>' +
      '<div class="nutrition-macro-label">kcal</div></div>'
    );
    if (macros.protein) items.push(
      '<div class="nutrition-macro-item nc-macro-pro">' +
      '<div class="nutrition-macro-value">' + escapeHtml(macros.protein) + 'g</div>' +
      '<div class="nutrition-macro-label">' + tr('nutrition.macro.protein', 'Protein') + '</div></div>'
    );
    if (macros.carbs) items.push(
      '<div class="nutrition-macro-item nc-macro-carb">' +
      '<div class="nutrition-macro-value">' + escapeHtml(macros.carbs) + 'g</div>' +
      '<div class="nutrition-macro-label">' + tr('nutrition.macro.carbs', 'Carbs') + '</div></div>'
    );
    if (macros.fat) items.push(
      '<div class="nutrition-macro-item nc-macro-fat">' +
      '<div class="nutrition-macro-value">' + escapeHtml(macros.fat) + 'g</div>' +
      '<div class="nutrition-macro-label">' + tr('nutrition.macro.fat', 'Fat') + '</div></div>'
    );
    return '<div class="nutrition-macro-card">' + items.join('') + '</div>';
  }

  // ─── Timestamp formatting ─────────────────────────────────────────────

  function _formatTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var now = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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

  function _renderMessages() {
    var container = document.getElementById('nutrition-messages');
    if (!container) return;
    var inputBar = document.querySelector('.nutrition-input-bar');

    // If no API key, show setup card
    if (!getNutritionApiKey()) {
      if (inputBar) inputBar.classList.add('nc-hidden');
      container.innerHTML = _renderSetupCard();
      if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(container);
      return;
    }

    // Show input bar
    if (inputBar) inputBar.classList.remove('nc-hidden');

    // Empty state with quick prompts
    if (!_history.length) {
      container.innerHTML = _renderEmptyState();
      if (window.I18N && I18N.applyTranslations) I18N.applyTranslations(container);
      return;
    }

    // Render conversation
    container.innerHTML = _history
      .map(function (msg, idx) {
        var time = '<div class="nutrition-msg-time">' + _formatTimestamp(msg.timestamp) + '</div>';
        if (msg.role === 'user') {
          return (
            '<div class="nutrition-msg nutrition-msg-user">' +
            (msg.imageDataUrl
              ? '<img class="nutrition-msg-img" src="' + escapeHtml(msg.imageDataUrl) + '" alt="">'
              : '') +
            (msg.text
              ? '<div class="nutrition-msg-text">' + escapeHtml(msg.text) + '</div>'
              : '') +
            time +
            '</div>'
          );
        }
        // Coach message with avatar + macro card
        var isLast = idx === _history.length - 1;
        var isStreaming = isLast && _streaming;
        var macros = !msg.isError && !isStreaming ? _extractMacros(msg.text || '') : null;
        var macroHtml = macros ? _renderMacroCard(macros) : '';
        var retryHtml = msg.isError
          ? '<div class="nutrition-msg-text"><button class="nutrition-retry-btn" onclick="retryLastNutritionMessage()" data-i18n="nutrition.retry">' +
            tr('nutrition.retry', 'Try again') + '</button></div>'
          : '';
        var modelTag = msg.model
          ? ' · ' + msg.model.replace(/^claude-/, '').replace(/-\d{8}$/, '').replace(/-\d+$/, '')
          : '';
        var cursorHtml = isStreaming ? '<span class="nc-cursor"></span>' : '';
        return (
          '<div class="nutrition-msg nutrition-msg-coach' +
          (msg.isError ? ' nutrition-msg-error' : '') + '">' +
          _avatarHtml +
          '<div class="nutrition-msg-body">' +
          macroHtml +
          '<div class="nutrition-msg-text">' +
          _formatText(msg.text || '') +
          cursorHtml +
          '</div>' +
          retryHtml +
          '<div class="nutrition-msg-time">' + _formatTimestamp(msg.timestamp) + modelTag + '</div>' +
          '</div></div>'
        );
      })
      .join('');
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
    if (!val) { showToast(tr('nutrition.setup.empty', 'Enter an API key'), 'var(--red)'); return; }
    localStorage.setItem(_apiKeyStorageKey(), val);
    // Also update the Settings input if it exists
    var settingsInp = document.getElementById('nutrition-api-key-input');
    if (settingsInp) settingsInp.value = val;
    showToast(tr('settings.claude_api_key.saved', 'API key saved'), 'var(--green)');
    _renderMessages();
  }

  // ─── Premium empty state ──────────────────────────────────────────────

  function _renderEmptyState() {
    return (
      '<div class="nutrition-empty">' +
      '<div class="nutrition-empty-kicker" data-i18n="nutrition.empty.kicker">AI NUTRITION COACH</div>' +
      '<div class="nutrition-empty-orb">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36">' +
      '<path d="M17 8c.7-3.4-.8-6.2-3-7.5C12.3 3 11.5 5.4 12 8"/>' +
      '<path d="M12 8c-4 0-7 2.5-7 6 0 4.5 3 8 7 8s7-3.5 7-8c0-3.5-3-6-7-6z"/>' +
      '</svg></div>' +
      '<div class="nutrition-empty-title" data-i18n="nutrition.empty.title">Your personal nutrition coach</div>' +
      '<div class="nutrition-empty-sub" data-i18n="nutrition.empty.body">' +
      'Snap a meal photo, ask questions, and get personalised advice based on your training.</div>' +
      '<div class="nutrition-quick-prompts">' +
      _renderPromptChip('nutrition.prompt.pre_workout', 'What should I eat before training?') +
      _renderPromptChip('nutrition.prompt.protein', 'Help me hit my protein target') +
      _renderPromptChip('nutrition.prompt.rate', 'Rate my last meal') +
      '</div>' +
      '</div>'
    );
  }

  function _renderPromptChip(i18nKey, fallback) {
    return (
      '<button class="nutrition-prompt-chip" data-nc-prompt="' + escapeHtml(fallback) + '" data-nc-prompt-key="' + i18nKey + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<line x1="5" y1="12" x2="19" y2="12"/>' +
      '<polyline points="12 5 19 12 12 19"/>' +
      '</svg>' +
      '<span data-i18n="' + i18nKey + '">' + escapeHtml(fallback) + '</span>' +
      '</button>'
    );
  }

  // Delegated click handler for prompt chips (avoids inline onclick escaping issues)
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.nutrition-prompt-chip');
    if (!chip) return;
    var key = chip.getAttribute('data-nc-prompt-key');
    var fallback = chip.getAttribute('data-nc-prompt');
    var text = key ? tr(key, fallback) : fallback;
    if (text) {
      var input = document.getElementById('nutrition-input');
      if (input) { input.value = text; input.focus(); }
      submitNutritionMessage();
    }
  });

  // ─── Body metrics context banner ──────────────────────────────────────

  function _renderContextBanner() {
    var bm = (typeof profile !== 'undefined' && profile.bodyMetrics) || {};
    var parts = [];
    if (bm.weight) parts.push(bm.weight + ' kg');
    var goalLabels = { lose_fat: 'lose fat', gain_muscle: 'gain muscle', recomp: 'recomp', maintain: 'maintain' };
    if (bm.bodyGoal && goalLabels[bm.bodyGoal]) parts.push(goalLabels[bm.bodyGoal]);

    var targets = _calculateTargets();
    if (targets) parts.push(targets.calories + ' kcal/day');

    if (parts.length) {
      return (
        '<div class="nutrition-context-banner">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
        '<span>' + tr('nutrition.banner.personalized', 'Personalised for') + ': ' + escapeHtml(parts.join(', ')) + '</span>' +
        '</div>'
      );
    }
    return (
      '<div class="nutrition-context-banner">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
      '<span>' + tr('nutrition.banner.setup_body', 'Set up your body profile for personalised advice') +
      ' <a onclick="showPage(\'settings\', document.querySelectorAll(\'.nav-btn\')[3])">' +
      tr('nutrition.banner.settings_link', 'Settings') + ' &rarr;</a></span>' +
      '</div>'
    );
  }

  // ─── Today's intake summary card ─────────────────────────────────────

  function _renderTodayCard() {
    var todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    var ts = todayStart.getTime();

    var totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    var mealCount = 0;

    for (var i = 0; i < _history.length; i++) {
      var msg = _history[i];
      if (msg.role !== 'assistant' || msg.isError || !msg.timestamp || msg.timestamp < ts) continue;
      var macros = _extractMacros(msg.text || '');
      if (!macros) continue;
      mealCount++;
      if (macros.calories) totals.calories += parseFloat(macros.calories) || 0;
      if (macros.protein) totals.protein += parseFloat(macros.protein) || 0;
      if (macros.carbs) totals.carbs += parseFloat(macros.carbs) || 0;
      if (macros.fat) totals.fat += parseFloat(macros.fat) || 0;
    }

    if (!mealCount) return '';

    var targets = _calculateTargets();
    var calStr = Math.round(totals.calories) + (targets ? ' / ' + targets.calories : '') + ' kcal';
    var proStr = Math.round(totals.protein) + 'g ' + tr('nutrition.macro.protein', 'protein');
    var pct = targets ? Math.min(100, Math.round((totals.calories / targets.calories) * 100)) : 0;
    var barHtml = targets
      ? '<div class="nc-today-bar"><div class="nc-today-bar-fill" style="width:' + pct + '%"></div></div>'
      : '';

    return (
      '<div class="nutrition-today-card">' +
      '<div><div class="nc-today-label">' + tr('nutrition.today.label', 'Today') + '</div></div>' +
      '<div style="flex:1"><div class="nc-today-values"><strong>' + calStr + '</strong> · ' + proStr + '</div>' +
      barHtml + '</div></div>'
    );
  }

  // ─── Overflow menu ────────────────────────────────────────────────────

  function toggleNutritionMenu() {
    var menu = document.getElementById('nutrition-overflow-menu');
    if (!menu) return;
    var isOpen = menu.classList.contains('open');
    menu.classList.toggle('open', !isOpen);
    if (!isOpen) {
      // Close on outside click
      setTimeout(function () {
        document.addEventListener('click', _closeMenuOnOutside, { once: true });
      }, 10);
    }
  }

  function _closeMenuOnOutside(e) {
    var menu = document.getElementById('nutrition-overflow-menu');
    var wrap = menu && menu.closest('.nutrition-overflow-wrap');
    if (menu && wrap && !wrap.contains(e.target)) {
      menu.classList.remove('open');
    } else if (menu && menu.classList.contains('open')) {
      // Still open, re-listen
      setTimeout(function () {
        document.addEventListener('click', _closeMenuOnOutside, { once: true });
      }, 10);
    }
  }

  // ─── Retry last message ───────────────────────────────────────────────

  function retryLastNutritionMessage() {
    // Find the last user message and replay it
    for (var i = _history.length - 1; i >= 0; i--) {
      if (_history[i].role === 'user') {
        var text = _history[i].text;
        var image = _history[i].imageDataUrl;
        // Remove the user message and everything after it (error response)
        _history.splice(i);
        _saveHistory();
        _renderMessages();
        sendNutritionMessage(text, image);
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
        _pendingImage = compressed;
        const preview = document.getElementById('nutrition-photo-preview');
        const img = document.getElementById('nutrition-preview-img');
        if (preview && img) {
          img.src = compressed;
          preview.style.display = 'flex';
        }
      });
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // allow re-selecting same file
  }

  function clearNutritionPhoto() {
    _pendingImage = null;
    const preview = document.getElementById('nutrition-photo-preview');
    const img = document.getElementById('nutrition-preview-img');
    if (preview) preview.style.display = 'none';
    if (img) img.src = '';
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────

  function submitNutritionMessage() {
    const input = document.getElementById('nutrition-input');
    const text = input ? input.value.trim() : '';
    const image = _pendingImage;

    if (!text && !image) return;

    if (input) input.value = '';
    clearNutritionPhoto();

    sendNutritionMessage(text, image);
  }

  // ─── Clear history ────────────────────────────────────────────────────────────

  function clearNutritionHistory() {
    showConfirm(
      tr('nutrition.clear.title', 'Clear conversation'),
      tr('nutrition.clear.body', 'This will delete your entire nutrition conversation history.'),
      function () {
        _clearHistory();
        _renderMessages();
      }
    );
  }

  // ─── Page init ────────────────────────────────────────────────────────────────

  function initNutritionPage() {
    _loadHistory();
    _renderMessages();

    // Remove previous banners/cards to avoid duplicates
    var oldBanner = document.querySelector('.nutrition-context-banner');
    if (oldBanner) oldBanner.remove();
    var oldCard = document.querySelector('.nutrition-today-card');
    if (oldCard) oldCard.remove();

    if (getNutritionApiKey()) {
      var bannerSlot = document.getElementById('nutrition-messages');
      if (bannerSlot && _history.length) {
        var todayHtml = _renderTodayCard();
        if (todayHtml) bannerSlot.insertAdjacentHTML('beforebegin', todayHtml);
        bannerSlot.insertAdjacentHTML('beforebegin', _renderContextBanner());
      }
    }

    // Attach enter-key handler each time (safe to re-attach)
    var input = document.getElementById('nutrition-input');
    if (input) {
      input.onkeydown = function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          submitNutritionMessage();
        }
      };
    }

    // Mobile keyboard handling — resize the page to fit above the keyboard
    // so the input bar never gets pushed behind it
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        var page = document.getElementById('page-nutrition');
        if (!page) return;
        var kbHeight = window.innerHeight - window.visualViewport.height;
        if (kbHeight > 50) {
          // Keyboard is open: shrink the page to the visible area.
          // Reset any content scroll first so getBoundingClientRect is stable.
          var content = document.querySelector('.content');
          if (content) content.scrollTop = 0;
          var nav = document.querySelector('.bottom-nav');
          var navH = nav ? nav.offsetHeight : 60;
          var pageTop = page.getBoundingClientRect().top;
          page.style.height = Math.max(200, window.visualViewport.height - Math.max(0, pageTop) - navH) + 'px';
          _scrollToBottom();
        } else {
          // Keyboard closed: restore CSS-driven height
          page.style.height = '';
        }
      });
    }

    _scrollToBottom();
  }

  // ─── Expose globals ───────────────────────────────────────────────────────────

  window.initNutritionPage = initNutritionPage;
  window.handleNutritionPhoto = handleNutritionPhoto;
  window.clearNutritionPhoto = clearNutritionPhoto;
  window.submitNutritionMessage = submitNutritionMessage;
  window.clearNutritionHistory = clearNutritionHistory;
  window.getNutritionApiKey = getNutritionApiKey;
  window.saveNutritionApiKey = saveNutritionApiKey;
  window.saveNutritionSetupKey = saveNutritionSetupKey;
  window.toggleNutritionMenu = toggleNutritionMenu;
  window.retryLastNutritionMessage = retryLastNutritionMessage;
})();
