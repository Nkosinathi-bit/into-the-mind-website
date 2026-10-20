/* Shared interactions for Into the Mind. No accounts or external services required. */
(() => {
    'use strict';

    const articles = [
        { file: 'article-stress-management.html', title: 'Managing Academic Stress', topics: ['stress', 'mindfulness'] },
        { file: 'article-social-anxiety.html', title: 'Social Anxiety in University Settings', topics: ['anxiety'] },
        { file: 'article-seasonal-depression.html', title: 'Recognizing Seasonal Depression', topics: ['depression'] },
        { file: 'article-mindful-studying.html', title: 'Mindful Studying', topics: ['mindfulness'] },
        { file: 'article-sleep-hygiene.html', title: 'Sleep Hygiene for Students', topics: ['sleep'] },
        { file: 'article-time-management.html', title: 'Time Management Strategies', topics: ['stress'] },
        { file: 'article-therapy-options.html', title: 'Understanding Therapy Options', topics: ['anxiety', 'depression'] },
        { file: 'article-anxiety.html', title: 'Understanding Anxiety', topics: ['anxiety'] }
    ];
    const validFiles = new Set(articles.map(article => article.file));
    const storageKey = 'into-the-mind:v1';
    let canSave = true;
    let state = { savedArticles: [], challengeDays: [] };
    let refreshArticles = () => {};

    // Only article filenames and completed day numbers are saved, never form text.
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
        if (stored && typeof stored === 'object') {
            state.savedArticles = Array.isArray(stored.savedArticles)
                ? [...new Set(stored.savedArticles.filter(file => validFiles.has(file)))] : [];
            state.challengeDays = Array.isArray(stored.challengeDays)
                ? [...new Set(stored.challengeDays.filter(day => Number.isInteger(day) && day >= 1 && day <= 7))] : [];
        }
    } catch {
        canSave = false;
    }

    function storageNotice() {
        document.querySelectorAll('[data-storage-note]').forEach(note => {
            note.textContent = canSave
                ? 'Saved on this browser only. You can undo each saved item.'
                : 'Your changes work for this visit, but this browser could not save them for next time.';
        });
    }

    function saveState() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
            canSave = true;
        } catch {
            canSave = false;
        }
        storageNotice();
    }

    const liveStatus = document.createElement('p');
    liveStatus.className = 'site-status';
    liveStatus.setAttribute('role', 'status');
    document.body.append(liveStatus);
    let statusTimeout;

    function announce(message) {
        clearTimeout(statusTimeout);
        liveStatus.textContent = message;
        statusTimeout = setTimeout(() => { liveStatus.textContent = ''; }, 5000);
    }

    function renderBookmarks() {
        document.querySelectorAll('[data-save-article]').forEach(button => {
            const article = articles.find(item => item.file === button.dataset.saveArticle);
            if (!article) return;
            const saved = state.savedArticles.includes(article.file);
            button.hidden = false;
            button.setAttribute('aria-pressed', String(saved));
            button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${article.title} ${saved ? 'from saved articles' : 'for later'}`);
            button.textContent = saved ? 'Saved — remove' : 'Save for later';
        });
        const count = document.querySelector('[data-saved-count]');
        if (count) count.textContent = String(state.savedArticles.length);
    }

    document.querySelectorAll('[data-save-article]').forEach(button => {
        button.addEventListener('click', () => {
            const file = button.dataset.saveArticle;
            if (!validFiles.has(file)) return;
            const saved = state.savedArticles.includes(file);
            state.savedArticles = saved ? state.savedArticles.filter(item => item !== file) : [...state.savedArticles, file];
            saveState();
            renderBookmarks();
            refreshArticles();
            announce(saved ? 'Article removed from your reading list.' : (canSave ? 'Article saved for later on this browser.' : 'Article saved for this visit only.'));
        });
    });
    renderBookmarks();

    function initArticleBrowser() {
        const browser = document.querySelector('[data-article-browser]');
        if (!browser) return;
        const cards = [...browser.querySelectorAll('.article-card[data-category]')];
        const filters = [...browser.querySelectorAll('[data-topic]')];
        const search = browser.querySelector('#article-search');
        const savedOnly = browser.querySelector('#saved-only');
        const status = browser.querySelector('#article-results');
        const empty = browser.querySelector('#article-empty');
        const requestedTopic = new URLSearchParams(location.search).get('topic');
        let topic = filters.some(button => button.dataset.topic === requestedTopic) ? requestedTopic : 'all';
        savedOnly.checked = new URLSearchParams(location.search).get('saved') === '1';

        refreshArticles = () => {
            const query = search.value.trim().toLocaleLowerCase();
            let visible = 0;
            cards.forEach(card => {
                const file = card.querySelector('[data-save-article]').dataset.saveArticle;
                const searchable = [...card.querySelectorAll('h3, .article-excerpt, .article-category')].map(item => item.textContent).join(' ');
                const matches = (topic === 'all' || card.dataset.category.split(' ').includes(topic))
                    && searchable.toLocaleLowerCase().includes(query)
                    && (!savedOnly.checked || state.savedArticles.includes(file));
                card.hidden = !matches;
                if (matches) visible += 1;
            });
            browser.querySelectorAll('.featured-article, .article-grid').forEach(section => {
                section.hidden = ![...section.querySelectorAll('.article-card')].some(card => !card.hidden);
            });
            filters.forEach(button => {
                const active = button.dataset.topic === topic;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            status.textContent = `${visible} ${visible === 1 ? 'article' : 'articles'} found${topic === 'all' ? '' : ` for ${topic}`}${savedOnly.checked ? ' in your saved list' : ''}.`;
            empty.hidden = visible !== 0;
        };
        filters.forEach(button => button.addEventListener('click', () => { topic = button.dataset.topic; refreshArticles(); }));
        search.addEventListener('input', refreshArticles);
        savedOnly.addEventListener('change', refreshArticles);
        browser.querySelector('[data-clear-filters]').addEventListener('click', () => {
            topic = 'all';
            search.value = '';
            savedOnly.checked = false;
            refreshArticles();
            search.focus();
        });
        refreshArticles();
    }

    // Replace inactive newsletter signups with an immediately usable reading plan.
    document.querySelectorAll('[data-reading-plan]').forEach(form => {
        form.addEventListener('submit', event => {
            event.preventDefault();
            const topic = form.elements.topic.value;
            const result = form.parentElement.querySelector('[data-plan-result]');
            const list = document.createElement('ul');
            articles.filter(article => article.topics.includes(topic)).forEach(article => {
                const item = document.createElement('li');
                const link = document.createElement('a');
                link.href = article.file;
                link.textContent = article.title;
                item.append(link);
                list.append(item);
            });
            result.replaceChildren();
            const heading = document.createElement('h3');
            heading.textContent = 'Your next small reads';
            result.append(heading, list);
            result.hidden = false;
            result.focus();
            announce('Your reading plan is ready. Choose an article to begin.');
        });
    });

    function initChallenge() {
        const challenge = document.querySelector('[data-challenge]');
        if (!challenge) return;
        const buttons = [...challenge.querySelectorAll('[data-complete-day]')];
        const progress = challenge.querySelector('progress');
        const summary = challenge.querySelector('[data-challenge-summary]');
        const render = () => {
            buttons.forEach(button => {
                const completed = state.challengeDays.includes(Number(button.dataset.completeDay));
                button.setAttribute('aria-pressed', String(completed));
                button.setAttribute('aria-label', `${completed ? 'Undo' : 'Mark'} day ${button.dataset.completeDay}${completed ? ' completion' : ' complete'}`);
                button.textContent = completed ? 'Completed — undo' : 'Mark complete';
                button.closest('.day-card').classList.toggle('is-complete', completed);
            });
            progress.value = state.challengeDays.length;
            summary.textContent = state.challengeDays.length === 7
                ? '7 of 7 complete. A whole week of small steps — well done!'
                : `${state.challengeDays.length} of 7 complete. Go at your own pace.`;
        };
        buttons.forEach(button => button.addEventListener('click', () => {
            const day = Number(button.dataset.completeDay);
            state.challengeDays = state.challengeDays.includes(day)
                ? state.challengeDays.filter(item => item !== day) : [...state.challengeDays, day];
            saveState();
            render();
        }));
        render();
    }

    function initTimer() {
        const timer = document.querySelector('[data-focus-timer]');
        if (!timer) return;
        const select = timer.querySelector('select');
        const display = timer.querySelector('[data-timer-display]');
        const start = timer.querySelector('[data-timer-start]');
        const reset = timer.querySelector('[data-timer-reset]');
        const status = timer.querySelector('[data-timer-status]');
        const progress = timer.querySelector('progress');
        let duration = Number(select.value);
        let remaining = duration;
        let endTime = 0;
        let interval = null;
        const render = () => {
            const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
            const seconds = String(remaining % 60).padStart(2, '0');
            display.textContent = `${minutes}:${seconds}`;
            progress.max = duration;
            progress.value = duration - remaining;
        };
        const stop = () => { clearInterval(interval); interval = null; };
        const tick = () => {
            // A deadline keeps the timer accurate when the tab is in the background.
            remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            render();
            if (remaining === 0) {
                stop();
                start.textContent = 'Start again';
                select.disabled = false;
                status.textContent = 'Session complete. Take a moment before your next step.';
            }
        };
        const resetTimer = () => {
            stop();
            duration = Number(select.value);
            remaining = duration;
            select.disabled = false;
            start.textContent = 'Start timer';
            status.textContent = 'Ready when you are.';
            render();
        };
        start.addEventListener('click', () => {
            if (interval !== null) {
                tick();
                stop();
                if (remaining > 0) {
                    start.textContent = 'Resume timer';
                    status.textContent = 'Paused. Continue when you are ready.';
                }
                return;
            }
            if (remaining === 0) remaining = duration;
            endTime = Date.now() + remaining * 1000;
            select.disabled = true;
            start.textContent = 'Pause timer';
            status.textContent = 'Your session is in progress.';
            interval = setInterval(tick, 250);
            render();
        });
        reset.addEventListener('click', resetTimer);
        select.addEventListener('change', resetTimer);
        document.addEventListener('visibilitychange', () => { if (interval !== null) tick(); });
        render();
    }

    function initMessagePreview() {
        const form = document.querySelector('[data-message-form]');
        if (!form) return;
        const preview = document.querySelector('[data-message-preview]');
        const content = preview.querySelector('pre');
        const download = preview.querySelector('[data-download-message]');
        let downloadUrl;
        const clearPreview = () => {
            preview.hidden = true;
            content.textContent = '';
            download.removeAttribute('href');
            if (downloadUrl) URL.revokeObjectURL(downloadUrl);
            downloadUrl = null;
        };
        // Enable only after listeners are ready, so no message can be posted accidentally.
        form.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = false; });
        form.elements.subject.options[0].disabled = true;
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const subject = form.elements.subject.selectedOptions[0].textContent;
            const text = `Message draft — not sent\n\nFrom: ${form.elements.name.value.trim()}\nEmail: ${form.elements.email.value.trim()}\nSubject: ${subject}\n\n${form.elements.message.value.trim()}`;
            clearPreview();
            content.textContent = text;
            downloadUrl = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
            download.href = downloadUrl;
            preview.hidden = false;
            preview.focus();
            announce('Your message preview is ready. Nothing has been sent.');
        });
        form.addEventListener('input', clearPreview);
        form.addEventListener('change', clearPreview);
        form.addEventListener('reset', clearPreview);
        window.addEventListener('pagehide', clearPreview);
    }

    document.querySelectorAll('[data-js-only]').forEach(element => { element.hidden = false; });
    initArticleBrowser();
    initChallenge();
    initTimer();
    initMessagePreview();
    storageNotice();
})();
