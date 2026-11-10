// Facebook Publisher Studio - Client Controller
document.addEventListener('DOMContentLoaded', () => {

  // DOM Elements - Status & Navigation
  const pageStatusPill = document.getElementById('pageStatusPill');
  const pageStatusLabel = document.getElementById('pageStatusLabel');
  const setupBanner = document.getElementById('setupBanner');
  const bannerSetupBtn = document.getElementById('bannerSetupBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  // DOM Elements - Settings Modal Form
  const settingsForm = document.getElementById('settingsForm');
  const settingsPageId = document.getElementById('settingsPageId');
  const settingsAccessToken = document.getElementById('settingsAccessToken');
  const settingsAlert = document.getElementById('settingsAlert');
  const testConnectionBtn = document.getElementById('testConnectionBtn');

  // DOM Elements - Composer
  const postForm = document.getElementById('postForm');
  const postMessage = document.getElementById('postMessage');
  const postLink = document.getElementById('postLink');
  const postImageUrl = document.getElementById('postImageUrl');
  const linkGroup = document.getElementById('linkGroup');
  const photoGroup = document.getElementById('photoGroup');
  const formatTabs = document.querySelectorAll('.tab-btn');
  const charCount = document.getElementById('charCount');
  const targetPageNameDisplay = document.getElementById('targetPageNameDisplay');
  const formAlert = document.getElementById('formAlert');
  const publishBtn = document.getElementById('publishBtn');
  const clearFormBtn = document.getElementById('clearFormBtn');

  // DOM Elements - Mock Preview
  const mockPageName = document.getElementById('mockPageName');
  const mockPageAvatar = document.getElementById('mockPageAvatar');
  const mockBodyText = document.getElementById('mockBodyText');
  const mockPhotoContainer = document.getElementById('mockPhotoContainer');
  const mockPhotoImage = document.getElementById('mockPhotoImage');
  const mockLinkContainer = document.getElementById('mockLinkContainer');
  const mockLinkDomain = document.getElementById('mockLinkDomain');
  const mockLinkUrl = document.getElementById('mockLinkUrl');

  // DOM Elements - History Log
  const historyTableBody = document.getElementById('historyTableBody');
  const emptyHistoryRow = document.getElementById('emptyHistoryRow');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // App State
  let activeTab = 'feed'; // 'feed' or 'photo'
  let sessionHistory = [];

  // Load custom credentials from localStorage if present
  function getCustomCredentials() {
    return {
      pageId: localStorage.getItem('fb_page_id') || '',
      accessToken: localStorage.getItem('fb_access_token') || '',
    };
  }

  // Save custom credentials to localStorage
  function saveCustomCredentials(pageId, token) {
    if (pageId) localStorage.setItem('fb_page_id', pageId.trim());
    else localStorage.removeItem('fb_page_id');

    if (token) localStorage.setItem('fb_access_token', token.trim());
    else localStorage.removeItem('fb_access_token');
  }

  // 1. Initial Status Check
  async function checkServerStatus(customCredentials = null) {
    const creds = customCredentials || getCustomCredentials();
    const query = new URLSearchParams();
    if (creds.pageId) query.append('pageId', creds.pageId);
    if (creds.accessToken) query.append('accessToken', creds.accessToken);

    pageStatusLabel.textContent = 'Connecting to Meta...';

    try {
      const res = await fetch(`/api/status?${query.toString()}`);
      const data = await res.json();

      if (data.configured && data.valid && data.page) {
        // Connected successfully to Facebook Page
        pageStatusPill.className = 'status-pill status-connected';
        pageStatusLabel.textContent = `Connected: ${data.page.name}`;
        setupBanner.style.display = 'none';

        // Update UI mock with real Page data
        mockPageName.textContent = data.page.name;
        targetPageNameDisplay.textContent = data.page.name;
        if (data.page.picture) {
          mockPageAvatar.src = data.page.picture;
        }
        return { success: true, page: data.page };
      } else {
        // Not configured or invalid token
        pageStatusPill.className = 'status-pill status-disconnected';
        pageStatusLabel.textContent = data.error ? 'Invalid Credentials' : 'Setup Required';
        setupBanner.style.display = 'flex';
        return { success: false, error: data.error || data.message };
      }
    } catch (err) {
      pageStatusPill.className = 'status-pill status-disconnected';
      pageStatusLabel.textContent = 'Server Offline';
      return { success: false, error: err.message };
    }
  }

  // 2. Format Switcher Tabs (Standard vs Photo)
  formatTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      formatTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.type;

      if (activeTab === 'photo') {
        photoGroup.style.display = 'block';
        linkGroup.style.display = 'none';
        mockLinkContainer.style.display = 'none';
        updatePhotoPreview();
      } else {
        photoGroup.style.display = 'none';
        linkGroup.style.display = 'block';
        mockPhotoContainer.style.display = 'none';
        updateLinkPreview();
      }
    });
  });

  // 3. Live Preview Synchronizers
  postMessage.addEventListener('input', () => {
    const text = postMessage.value;
    charCount.textContent = `${text.length} characters`;

    if (text.trim().length > 0) {
      mockBodyText.textContent = text;
      mockBodyText.style.color = 'var(--fb-text)';
    } else {
      mockBodyText.textContent = 'Start typing your post in the composer on the left to see the live preview...';
      mockBodyText.style.color = 'var(--fb-text-muted)';
    }
  });

  function updateLinkPreview() {
    const url = postLink.value.trim();
    if (activeTab === 'feed' && url) {
      try {
        const parsed = new URL(url);
        mockLinkDomain.textContent = parsed.hostname.toUpperCase();
        mockLinkUrl.textContent = url;
        mockLinkContainer.style.display = 'block';
      } catch {
        mockLinkDomain.textContent = 'LINK PREVIEW';
        mockLinkUrl.textContent = url;
        mockLinkContainer.style.display = 'block';
      }
    } else {
      mockLinkContainer.style.display = 'none';
    }
  }
  postLink.addEventListener('input', updateLinkPreview);

  function updatePhotoPreview() {
    const imgUrl = postImageUrl.value.trim();
    if (activeTab === 'photo' && imgUrl) {
      mockPhotoImage.src = imgUrl;
      mockPhotoContainer.style.display = 'flex';
      mockPhotoImage.onerror = () => {
        mockPhotoContainer.style.display = 'none';
      };
    } else {
      mockPhotoContainer.style.display = 'none';
    }
  }
  postImageUrl.addEventListener('input', updatePhotoPreview);

  // 4. Form Submission: Publish Post
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = postMessage.value.trim();
    const link = postLink.value.trim();
    const imageUrl = postImageUrl.value.trim();
    const creds = getCustomCredentials();

    if (!message && !imageUrl) {
      showFormAlert('Please provide post text or an image URL.', 'danger');
      return;
    }

    // Set UI loading state
    setPublishingState(true);
    hideFormAlert();

    try {
      const payload = {
        message,
        link: activeTab === 'feed' ? link : '',
        imageUrl: activeTab === 'photo' ? imageUrl : '',
        pageId: creds.pageId || undefined,
        accessToken: creds.accessToken || undefined,
      };

      const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showFormAlert(
          `Post published successfully! <a href="${data.url}" target="_blank" rel="noopener" style="color: inherit; font-weight: 700; text-decoration: underline;">View on Facebook &rarr;</a>`,
          'success'
        );

        // Add to activity history table
        addToHistory({
          id: data.id,
          url: data.url,
          message: message || '(Photo post without caption)',
          type: activeTab === 'photo' ? 'Photo' : 'Standard Feed',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });

        // Reset form inputs
        postMessage.value = '';
        postLink.value = '';
        postImageUrl.value = '';
        charCount.textContent = '0 characters';
        mockBodyText.textContent = 'Start typing your post in the composer on the left to see the live preview...';
        mockBodyText.style.color = 'var(--fb-text-muted)';
        mockPhotoContainer.style.display = 'none';
        mockLinkContainer.style.display = 'none';
      } else {
        const errorMsg = data.details?.message || data.error || 'Failed to publish post.';
        showFormAlert(`Meta Error: ${errorMsg}`, 'danger');
      }
    } catch (err) {
      showFormAlert(`Network error: ${err.message}`, 'danger');
    } finally {
      setPublishingState(false);
    }
  });

  // Reset Button
  clearFormBtn.addEventListener('click', () => {
    postForm.reset();
    charCount.textContent = '0 characters';
    mockBodyText.textContent = 'Start typing your post in the composer on the left to see the live preview...';
    mockBodyText.style.color = 'var(--fb-text-muted)';
    mockPhotoContainer.style.display = 'none';
    mockLinkContainer.style.display = 'none';
    hideFormAlert();
  });

  // 5. Settings Modal Logic
  function openSettings() {
    const creds = getCustomCredentials();
    settingsPageId.value = creds.pageId;
    settingsAccessToken.value = creds.accessToken;
    settingsAlert.style.display = 'none';
    settingsModal.style.display = 'flex';
  }

  function closeSettings() {
    settingsModal.style.display = 'none';
  }

  openSettingsBtn.addEventListener('click', openSettings);
  bannerSetupBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);

  // Close modal when clicking on backdrop
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // Test Connection inside Settings Modal
  testConnectionBtn.addEventListener('click', async () => {
    const testPageId = settingsPageId.value.trim();
    const testToken = settingsAccessToken.value.trim();

    if (!testPageId || !testToken) {
      showSettingsAlert('Please enter both Page ID and Page Access Token to test.', 'danger');
      return;
    }

    const spinner = testConnectionBtn.querySelector('.btn-spinner');
    const text = testConnectionBtn.querySelector('.btn-text');
    spinner.style.display = 'inline-block';
    text.textContent = 'Verifying...';
    testConnectionBtn.disabled = true;

    const result = await checkServerStatus({ pageId: testPageId, accessToken: testToken });

    spinner.style.display = 'none';
    text.textContent = 'Test Connection';
    testConnectionBtn.disabled = false;

    if (result.success) {
      showSettingsAlert(`Connected successfully to Page: "${result.page.name}"!`, 'success');
    } else {
      showSettingsAlert(`Verification failed: ${result.error}`, 'danger');
    }
  });

  // Save Settings Modal
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pageId = settingsPageId.value.trim();
    const token = settingsAccessToken.value.trim();

    saveCustomCredentials(pageId, token);
    closeSettings();
    checkServerStatus();
  });

  // 6. Activity Log Helpers
  function addToHistory(item) {
    sessionHistory.unshift(item);
    renderHistory();
  }

  function renderHistory() {
    if (sessionHistory.length === 0) {
      emptyHistoryRow.style.display = 'table-row';
      return;
    }

    emptyHistoryRow.style.display = 'none';
    historyTableBody.innerHTML = '';

    sessionHistory.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="badge" style="background-color: var(--success-bg); color: var(--success);">Published</span></td>
        <td style="max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.message)}">
          ${escapeHtml(item.message)}
        </td>
        <td><span class="badge badge-info">${escapeHtml(item.type)}</span></td>
        <td style="color: var(--fb-text-muted); font-size: 0.8rem;">${item.timestamp}</td>
        <td>
          <a href="${item.url}" target="_blank" rel="noopener" class="btn btn-sm btn-secondary" style="text-decoration: none;">
            View on Facebook &rarr;
          </a>
        </td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    sessionHistory = [];
    renderHistory();
  });

  // 7. Utility UI Functions
  function setPublishingState(isLoading) {
    const spinner = publishBtn.querySelector('.btn-spinner');
    const text = publishBtn.querySelector('.btn-text');

    if (isLoading) {
      spinner.style.display = 'inline-block';
      text.textContent = 'Publishing to Facebook...';
      publishBtn.disabled = true;
    } else {
      spinner.style.display = 'none';
      text.textContent = 'Publish to Facebook';
      publishBtn.disabled = false;
    }
  }

  function showFormAlert(htmlContent, type) {
    formAlert.innerHTML = htmlContent;
    formAlert.className = `alert alert-${type}`;
    formAlert.style.display = 'block';
  }

  function hideFormAlert() {
    formAlert.style.display = 'none';
  }

  function showSettingsAlert(message, type) {
    settingsAlert.textContent = message;
    settingsAlert.className = `alert alert-${type}`;
    settingsAlert.style.display = 'block';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Initial check
  checkServerStatus();
});

