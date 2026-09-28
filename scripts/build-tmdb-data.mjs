import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tmdb-data.json');
const KEY = process.env.TMDB_API_KEY;
const BASE = 'https://api.themoviedb.org/3';
const CONCURRENCY = 5;

if (!KEY) {
  console.error('Missing TMDB_API_KEY environment variable.');
  process.exit(1);
}

const shows = vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'shows.js'), 'utf8') + '\n;SHOWS');
const imdbIds = [...new Set(shows.map((s) => s.imdb).filter(Boolean))].sort();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(p) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res = null;
    try {
      res = await fetch(`${BASE}${p}${p.includes('?') ? '&' : '?'}api_key=${KEY}`);
    } catch (e) {}
    if (res && res.ok) return res.json();
    if (res && res.status !== 429 && res.status < 500) return null;
    const retryAfter = res && Number(res.headers.get('retry-after'));
    await sleep(retryAfter ? retryAfter * 1000 : 500 * 2 ** attempt);
  }
  return null;
}

function pick(s) {
  return {
    id: s.id,
    name: s.name,
    number_of_episodes: s.number_of_episodes,
    number_of_seasons: s.number_of_seasons,
    episode_run_time: s.episode_run_time || [],
    genres: (s.genres || []).map((g) => ({ name: g.name })),
    networks: (s.networks || []).map((n) => ({ name: n.name })),
    created_by: (s.created_by || []).map((c) => ({ name: c.name })),
    production_countries: (s.production_countries || []).map((c) => ({ name: c.name })),
    origin_country: s.origin_country || [],
    spoken_languages: (s.spoken_languages || []).map((l) => ({ english_name: l.english_name, name: l.name })),
    original_language: s.original_language,
    seasons: (s.seasons || []).map((x) => ({ season_number: x.season_number, episode_count: x.episode_count, air_date: x.air_date })),
    vote_average: s.vote_average,
    vote_count: s.vote_count,
    popularity: s.popularity,
    first_air_date: s.first_air_date,
    last_air_date: s.last_air_date,
    status: s.status,
    poster_path: s.poster_path,
  };
}

let prev = {};
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')).shows || {}; } catch (e) {}

const next = {};
let failed = 0;
const queue = imdbIds.slice();

async function worker() {
  while (queue.length) {
    const imdb = queue.shift();
    let tmdbId = prev[imdb] && prev[imdb].id;
    if (!tmdbId) {
      const found = await tmdb(`/find/${encodeURIComponent(imdb)}?external_source=imdb_id`);
      tmdbId = found && found.tv_results && found.tv_results[0] && found.tv_results[0].id;
    }
    const tv = tmdbId ? await tmdb(`/tv/${tmdbId}`) : null;
    if (tv) {
      next[imdb] = pick(tv);
    } else {
      failed++;
      console.warn(`Could not fetch ${imdb}${prev[imdb] ? ' (keeping previous data)' : ''}`);
      if (prev[imdb]) next[imdb] = prev[imdb];
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, imdbIds.length) }, worker));

const ordered = {};
Object.keys(next).sort().forEach((k) => { ordered[k] = next[k]; });

if (!Object.keys(ordered).length) {
  console.error('No data fetched; leaving tmdb-data.json untouched.');
  process.exit(1);
}

if (JSON.stringify(ordered) === JSON.stringify(prev)) {
  console.log(`No changes (${Object.keys(ordered).length} shows, ${failed} failed).`);
} else {
  fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), shows: ordered }));
  console.log(`Wrote tmdb-data.json: ${Object.keys(ordered).length} shows, ${failed} failed.`);
}
