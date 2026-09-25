const form = document.getElementById('postForm');
const authorInput = document.getElementById('authorInput');
const contentInput = document.getElementById('contentInput');
const characterCount = document.getElementById('characterCount');
const feed = document.getElementById('feed');
const feedStatus = document.getElementById('feedStatus');
const refreshBtn = document.getElementById('refreshBtn');

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
    date.textContent = new Date(post.createdAt).toLocaleString();
    meta.append(author, date);
    const content = document.createElement('div');
    content.className = 'postContent';
    content.textContent = post.content;
    article.append(meta, content);
    feed.appendChild(article);
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
