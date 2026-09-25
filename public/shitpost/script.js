const form = document.getElementById('postForm');
const authorInput = document.getElementById('authorInput');
const contentInput = document.getElementById('contentInput');
const characterCount = document.getElementById('characterCount');
const feed = document.getElementById('feed');
const feedStatus = document.getElementById('feedStatus');
const refreshBtn = document.getElementById('refreshBtn');
const adminToggleBtn = document.getElementById('adminToggleBtn');

const EDIT_TOKENS_KEY = 'shitpost_edit_tokens';
const ADMIN_PASSWORD_KEY = 'shitpost_admin_password';
let isEditing = false; // приостанавливает автообновление, пока открыта форма правки

function getEditTokens() {
  try {
    return JSON.parse(localStorage.getItem(EDIT_TOKENS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveEditToken(postId, token) {
  const tokens = getEditTokens();
  tokens[postId] = token;
  localStorage.setItem(EDIT_TOKENS_KEY, JSON.stringify(tokens));
}

function removeEditToken(postId) {
  const tokens = getEditTokens();
  delete tokens[postId];
  localStorage.setItem(EDIT_TOKENS_KEY, JSON.stringify(tokens));
}

function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) || '';
}

function promptAdminPassword() {
  const value = prompt('Admin password:');
  if (value) {
    localStorage.setItem(ADMIN_PASSWORD_KEY, value);
  }
  return getAdminPassword();
}

function clearAdminPassword() {
  localStorage.removeItem(ADMIN_PASSWORD_KEY);
}

function updateAdminButton() {
  if (!adminToggleBtn) return;
  adminToggleBtn.textContent = getAdminPassword() ? 'Exit admin' : 'Admin';
}

function updateCharacterCount() {
  characterCount.textContent = `${contentInput.value.length} / 280`;
}

function renderPosts(posts) {
  feed.replaceChildren();
  if (!posts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'The wall is quiet. Start the conversation.';
    feed.appendChild(empty);
    return;
  }

  const editTokens = getEditTokens();
  const isAdmin = Boolean(getAdminPassword());

  posts.slice().reverse().forEach(post => {
    const article = document.createElement('article');
    article.className = 'post';

    const meta = document.createElement('div');
    meta.className = 'postMeta';
    const author = document.createElement('span');
    author.className = 'postAuthor';
    author.textContent = `@${post.author}`;
    const date = document.createElement('time');
    date.dateTime = post.createdAt;
    date.textContent = post.editedAt
      ? `${new Date(post.editedAt).toLocaleString()} (edited)`
      : new Date(post.createdAt).toLocaleString();
    meta.append(author, date);

    const content = document.createElement('div');
    content.className = 'postContent';
    content.textContent = post.content;

    article.append(meta, content);

    if (editTokens[post.id] || isAdmin) {
      const actions = document.createElement('div');
      actions.className = 'postActions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'editBtn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => startEdit(article, post, editTokens[post.id]));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'deleteBtn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deletePost(post, editTokens[post.id]));

      actions.append(editBtn, deleteBtn);
      article.appendChild(actions);
    }

    feed.appendChild(article);
  });
}

function startEdit(article, post, token) {
  isEditing = true;

  const content = article.querySelector('.postContent');
  const actions = article.querySelector('.postActions');

  const textarea = document.createElement('textarea');
  textarea.className = 'editArea';
  textarea.maxLength = 280;
  textarea.value = post.content;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';

  content.replaceWith(textarea);
  actions.replaceChildren(saveBtn, cancelBtn);
  textarea.focus();

  cancelBtn.addEventListener('click', () => {
    isEditing = false;
    loadPosts();
  });

  saveBtn.addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent) return;

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      const response = await fetch(`/api/shitposts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          editToken: token,
          adminPassword: getAdminPassword(),
        }),
      });
      if (!response.ok) throw new Error('Could not save');
      isEditing = false;
      await loadPosts();
    } catch {
      feedStatus.textContent = 'Could not save edit';
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

async function deletePost(post, token) {
  if (!confirm('Delete this post? This cannot be undone.')) return;

  try {
    const response = await fetch(`/api/shitposts/${post.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editToken: token,
        adminPassword: getAdminPassword(),
      }),
    });
    if (!response.ok) throw new Error('Could not delete');
    removeEditToken(post.id);
    await loadPosts();
  } catch {
    feedStatus.textContent = 'Could not delete post';
  }
}

async function loadPosts() {
  if (isEditing) return; // не сносим открытую форму редактирования
  try {
    const response = await fetch('/api/shitposts');
    if (!response.ok) throw new Error('Feed unavailable');
    const data = await response.json();
    renderPosts(Array.isArray(data.posts) ? data.posts : []);
    feedStatus.textContent = `${data.posts.length} post${data.posts.length === 1 ? '' : 's'}`;
  } catch {
    feedStatus.textContent = 'Feed unavailable';
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const submitButton = form.querySelector('button');
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/shitposts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: authorInput.value, content: contentInput.value }),
    });
    if (!response.ok) throw new Error('Could not post');
    const data = await response.json();
    if (data.post && data.editToken) {
      saveEditToken(data.post.id, data.editToken);
    }
    contentInput.value = '';
    updateCharacterCount();
    await loadPosts();
  } catch {
    feedStatus.textContent = 'Could not post right now';
  } finally {
    submitButton.disabled = false;
  }
});

contentInput.addEventListener('input', updateCharacterCount);
refreshBtn.addEventListener('click', loadPosts);

if (adminToggleBtn) {
  adminToggleBtn.addEventListener('click', () => {
    if (getAdminPassword()) {
      clearAdminPassword();
    } else {
      promptAdminPassword();
    }
    updateAdminButton();
    loadPosts();
  });
}

updateCharacterCount();
updateAdminButton();
loadPosts();
setInterval(loadPosts, 5000);