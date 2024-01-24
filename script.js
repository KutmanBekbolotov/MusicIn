const recentSearchesList = document.getElementById('recentSearchesList');
const playlistButton = document.getElementById('playlistButton');
const recentButton = document.getElementById('recentButton');
const playlistTab = document.getElementById('playlistTab');
const recentTab = document.getElementById('recentTab');
const searchResults = document.getElementById('searchResults');
const searchInput = document.getElementById('searchInput');
const playlistTracks = document.getElementById('playlistTracks');
const signUpForm = document.querySelector('.form-container.sign-up form');
const signInForm = document.querySelector('.form-container.sign-in form');
let sound;

let lastSearchQuery = '';

function closeTab(tabId) {
    const tab = document.getElementById(tabId);
    tab.classList.remove('show-tab');
}

function getAccessToken() {
    const clientId = '371a74204bbb49098c4cc7109f235eba';
    const clientSecret = 'd2ac5290750640dfa68433c546130e2f';

    fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    })
        .then(response => response.json())
        .then(data => {
            const accessToken = data.access_token;
            const query = searchInput.value;
            lastSearchQuery = query;
            searchMusic(query, accessToken);
        })
        .catch(error => console.error('Ошибка запроса токена:', error));
}

function searchMusic(query, accessToken) {
    fetch(`https://api.spotify.com/v1/search?q=${query}&type=track`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    })
        .then(response => response.json())
        .then(data => {
            displayResults(data.tracks.items);
        })
        .catch(error => console.error('Ошибка запроса:', error));
}

function displayResults(tracks) {
    searchResults.innerHTML = '';

    if (tracks.length === 0) {
        searchResults.innerHTML = '<p>Ничего не найдено</p>';
        return;
    }

    const ul = document.createElement('ul');

    tracks.forEach(track => {
        const li = document.createElement('li');
        li.textContent = `${track.name} - ${track.artists[0].name}`;

        li.addEventListener('click', function () {
            playPause(track, li);
        });

        const addToPlaylistButton = createButton('Добавить в плейлист', function (event) {
            event.stopPropagation();
            addToPlaylist(track);
        });

        const playPauseButton = createButton('Play', function (event) {
            event.stopPropagation();
            playPause(track, li);
        });

        li.appendChild(addToPlaylistButton);
        li.appendChild(playPauseButton);

        ul.appendChild(li);
    });

    searchResults.appendChild(ul);

    addToRecentSearchesOnSearch();
}

function playPause(track, listItem) {
    const isPlaying = sound && sound.playing() && sound.trackId === track.id;

    if (isPlaying) {
        sound.pause();
        listItem.querySelector(`button[data-track-id="${track.id}"]`).textContent = 'Play';
    } else {
        if (sound) {
            sound.stop();
        }

        sound = new Howl({
            src: [track.preview_url],
            html5: true,
            onend: function () {
                listItem.querySelector(`button[data-track-id="${track.id}"]`).textContent = 'Play';
            },
        });

        sound.play();
        sound.trackId = track.id;
        listItem.querySelector(`button[data-track-id="${track.id}"]`).textContent = 'Pause';
    }
}

function addToPlaylist(track) {
    const li = document.createElement('li');
    li.textContent = `${track.name} - ${track.artists[0].name}`;

    const playPauseButton = createButton('Play', function (event) {
        event.stopPropagation();
        playPause(track, li);
    });

    const deleteButton = createButton('Удалить', function (event) {
        event.stopPropagation();
        removeFromPlaylist(li);
    });

    li.appendChild(playPauseButton);
    li.appendChild(deleteButton);
    playlistTracks.appendChild(li);
}

function removeFromPlaylist(listItem) {
    playlistTracks.removeChild(listItem);
}

function addToRecentSearchesOnSearch() {
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];

    recentSearchesList.innerHTML = '';

    recentSearches.unshift(lastSearchQuery);

    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));

    recentSearches.forEach(query => {
        const li = document.createElement('li');
        li.textContent = query;

        li.addEventListener('click', function () {
            searchInput.value = query;
            getAccessToken();
        });

        recentSearchesList.appendChild(li);
    });
}

function clearRecentSearches() {
    localStorage.removeItem('recentSearches');
    recentSearchesList.innerHTML = '';
}

document.getElementById('searchButton').addEventListener('click', function () {
    getAccessToken();
});

playlistButton.addEventListener('click', function () {
    playlistTab.classList.toggle('show-tab');
    recentTab.classList.remove('show-tab');
});

recentButton.addEventListener('click', function () {
    recentTab.classList.toggle('show-tab');
    playlistTab.classList.remove('show-tab');
});

function createButton(text, clickHandler) {
    const button = document.createElement('button');
    button.textContent = text;
    button.addEventListener('click', clickHandler);
    return button;
}
let db;

// Открываем или создаем базу данных
const request = indexedDB.open('musicAppDatabase', 1);

request.onupgradeneeded = function(event) {
    // Создаем хранилище для плейлиста
    event.target.result.createObjectStore('playlist', { keyPath: 'id', autoIncrement: true });

    // Создаем хранилище для недавно воспроизведенных треков
    event.target.result.createObjectStore('recentlyPlayed', { keyPath: 'id', autoIncrement: true });
};

request.onsuccess = function(event) {
    // Устанавливаем соединение с базой данных
    db = event.target.result;

    // Делаем что-то после установления соединения, например, загружаем данные, если они есть
    loadPlaylistFromDB();
    loadRecentlyPlayedFromDB();
};

request.onerror = function(event) {
    console.error('Ошибка при открытии базы данных', event.target.error);
};

function addToPlaylistDB(track) {
    const transaction = db.transaction(['playlist'], 'readwrite');
    const playlistStore = transaction.objectStore('playlist');

    // Добавляем трек в хранилище плейлиста
    const request = playlistStore.add(track);

    request.onsuccess = function(event) {
        console.log('Трек добавлен в плейлист');
    };

    request.onerror = function(event) {
        console.error('Ошибка при добавлении трека в плейлист', event.target.error);
    };
}

function loadPlaylistFromDB() {
    const transaction = db.transaction(['playlist'], 'readonly');
    const playlistStore = transaction.objectStore('playlist');

    const request = playlistStore.getAll();

    request.onsuccess = function(event) {
        const tracks = event.target.result;

        // Восстанавливаем плейлист в пользовательском интерфейсе, например, используя addToPlaylist
        tracks.forEach(track => addToPlaylist(track));
    };

    request.onerror = function(event) {
        console.error('Ошибка при загрузке плейлиста из базы данных', event.target.error);
    };
}

function addToRecentlyPlayedDB(track) {
    const transaction = db.transaction(['recentlyPlayed'], 'readwrite');
    const recentlyPlayedStore = transaction.objectStore('recentlyPlayed');

    // Добавляем трек в хранилище недавно воспроизведенных треков
    const request = recentlyPlayedStore.add(track);

    request.onsuccess = function(event) {
        console.log('Трек добавлен в недавно воспроизведенные');
    };

    request.onerror = function(event) {
        console.error('Ошибка при добавлении трека в недавно воспроизведенные', event.target.error);
    };
}

function loadRecentlyPlayedFromDB() {
    const transaction = db.transaction(['recentlyPlayed'], 'readonly');
    const recentlyPlayedStore = transaction.objectStore('recentlyPlayed');

    const request = recentlyPlayedStore.getAll();

    request.onsuccess = function(event) {
        const tracks = event.target.result;

        // Восстанавливаем недавно воспроизведенные треки в пользовательском интерфейсе
        // Например, используя addToRecentlyPlayed
        tracks.forEach(track => addToRecentlyPlayed(track));
    };

    request.onerror = function(event) {
        console.error('Ошибка при загрузке недавно воспроизведенных из базы данных', event.target.error);
    };
}
