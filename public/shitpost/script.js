const form = document.getElementById('postForm');
const authorInput = document.getElementById('authorInput');
const contentInput = document.getElementById('contentInput');
const characterCount = document.getElementById('characterCount');
const feed = document.getElementById('feed');
const feedStatus = document.getElementById('feedStatus');
const refreshBtn = document.getElementById('refreshBtn');

const EDIT_TOKENS_KEY = 'shitpost_edit_tokens';

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

    if (editTokens[post.id]) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'editBtn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => startEdit(article, post, editTokens[post.id]));
      article.appendChild(editBtn);
    }

    feed.appendChild(article);
  });
}

function startEdit(article, post, token) {
  const content = article.querySelector('.postContent');
  const editBtn = article.querySelector('.editBtn');

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
  editBtn.replaceWith(saveBtn);
  saveBtn.after(cancelBtn);
  textarea.focus();

  cancelBtn.addEventListener('click', () => loadPosts());

  saveBtn.addEventListener('click', async () => {
    const newContent = textarea.value.trim();
    if (!newContent) return;

    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    try {
      const response = await fetch(`/api/shitposts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent, editToken: token }),
      });
      if (!response.ok) throw new Error('Could not save');
      await loadPosts();
    } catch {
      feedStatus.textContent = 'Could not save edit';
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });
}

async function loadPosts() {
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
updateCharacterCount();
loadPosts();
setInterval(loadPosts, 5000);