// Progress lives only in this browser's localStorage.

const KEY = 'free-the-x:v1';

const blank = () => ({ stars: {}, seenIntro: {}, muted: false });

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : blank();
  } catch {
    return blank();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode or storage full: progress just won't persist */
  }
}

const id = (w, i) => `${w}-${i}`;

export const store = {
  stars: (w, i) => data.stars[id(w, i)] || 0,
  setStars(w, i, n) {
    if (n > this.stars(w, i)) {
      data.stars[id(w, i)] = n;
      save();
    }
  },
  totalStars: () => Object.values(data.stars).reduce((a, b) => a + b, 0),
  seenIntro: (w) => !!data.seenIntro[w],
  markIntro(w) { data.seenIntro[w] = true; save(); },
  get muted() { return data.muted; },
  set muted(m) { data.muted = m; save(); },
  reset() { data = blank(); save(); },
};
