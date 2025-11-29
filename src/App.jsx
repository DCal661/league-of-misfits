import React, { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Trophy, TrendingUp, Users, MessageCircle, Award, ChevronRight, Send, User, RefreshCw, Crown } from 'lucide-react'

const LEAGUE_ID = "1258131568132624384"

const colors = {
  navy: '#1e3a5f',
  navyDark: '#142842',
  navyDeep: '#0a1628',
  navyLight: '#2a4a73',
  silver: '#c0c0c0',
  white: '#ffffff',
  gold: '#ffd700',
  accent: '#4a90d9',
  danger: '#ff4757',
  success: '#2ed573',
  warning: '#ffa502'
}

const api = {
  base: 'https://api.sleeper.app/v1',
  async get(endpoint) {
    try {
      const res = await fetch(`${this.base}${endpoint}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      console.error(`API Error: ${endpoint}`, e)
      return null
    }
  },
  nflState: () => api.get('/state/nfl'),
  league: () => api.get(`/league/${LEAGUE_ID}`),
  users: () => api.get(`/league/${LEAGUE_ID}/users`),
  rosters: () => api.get(`/league/${LEAGUE_ID}/rosters`),
  matchups: (week) => api.get(`/league/${LEAGUE_ID}/matchups/${week}`)
}

function useLeagueData() {
  const [data, setData] = useState({ loading: true, error: null, nflState: null, league: null, users: [], rosters: [], standings: [], currentWeek: 1, userMap: {} })
  
  const refresh = useCallback(async () => {
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      const [nflState, league, users, rosters] = await Promise.all([api.nflState(), api.league(), api.users(), api.rosters()])
      if (!nflState || !users || !rosters) throw new Error('Failed to fetch league data')
      
      const userMap = {}
      users.forEach(u => { userMap[u.user_id] = { name: u.display_name || u.username || 'Unknown', avatar: u.avatar ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}` : null } })
      
      const standings = rosters
        .map(r => ({ name: userMap[r.owner_id]?.name || `Team ${r.roster_id}`, avatar: userMap[r.owner_id]?.avatar, wins: r.settings?.wins || 0, losses: r.settings?.losses || 0, pf: (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100, pa: (r.settings?.fpts_against || 0) + (r.settings?.fpts_against_decimal || 0) / 100, rosterId: r.roster_id, ownerId: r.owner_id, streak: r.metadata?.streak || '' }))
        .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.pf - a.pf)
        .map((t, i) => ({ ...t, rank: i + 1 }))
      
      setData({ loading: false, error: null, nflState, league, users, rosters, standings, currentWeek: nflState.week || 1, userMap })
    } catch (e) { setData(d => ({ ...d, loading: false, error: e.message })) }
  }, [])
  
  useEffect(() => { refresh() }, [refresh])
  return { ...data, refresh }
}

function useMatchups(week, userMap, rosters) {
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!week || !userMap || !rosters) return
    setLoading(true)
    api.matchups(week).then(data => {
      if (!data) { setMatchups([]); setLoading(false); return }
      const rosterToUser = {}
      rosters.forEach(r => { rosterToUser[r.roster_id] = userMap[r.owner_id]?.name || `Team ${r.roster_id}` })
      const grouped = {}
      data.forEach(m => { const mid = m.matchup_id; if (!mid) return; if (!grouped[mid]) grouped[mid] = []; grouped[mid].push({ ...m, teamName: rosterToUser[m.roster_id] || `Team ${m.roster_id}`, points: m.points || 0 }) })
      const pairs = Object.values(grouped).filter(g => g.length === 2).map(([a, b]) => ({ team1: a.teamName, score1: a.points, team2: b.teamName, score2: b.points }))
      setMatchups(pairs)
      setLoading(false)
    })
  }, [week, userMap, rosters])
  return { matchups, loading }
}

function useWeeklyHistory(currentWeek) {
  const [history, setHistory] = useState([])
  useEffect(() => {
    if (!currentWeek || currentWeek < 1) return
    const fetchHistory = async () => {
      const weeks = []
      for (let w = 1; w <= Math.min(currentWeek, 17); w++) {
        const data = await api.matchups(w)
        if (data && data.length > 0) {
          const scores = data.map(m => m.points || 0).filter(p => p > 0)
          if (scores.length > 0) weeks.push({ week: w, high: Math.max(...scores), low: Math.min(...scores), avg: scores.reduce((a, b) => a + b, 0) / scores.length })
        }
      }
      setHistory(weeks)
    }
    fetchHistory()
  }, [currentWeek])
  return history
}

const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: `linear-gradient(145deg, ${colors.navy} 0%, ${colors.navyDark} 100%)`, borderRadius: '16px', padding: '20px', border: `1px solid ${colors.navyLight}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', cursor: onClick ? 'pointer' : 'default', ...style }}>{children}</div>
)

const LiveBadge = () => (
  <span style={{ background: colors.danger, color: colors.white, padding: '3px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
    <span style={{ width: '6px', height: '6px', background: colors.white, borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />LIVE
  </span>
)

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px' }}>
    <RefreshCw size={32} color={colors.accent} style={{ animation: 'spin 1s linear infinite' }} />
  </div>
)

const StatCard = ({ icon, value, label, color = colors.white }) => (
  <Card style={{ textAlign: 'center', padding: '16px' }}>
    <div style={{ fontSize: '28px', marginBottom: '6px' }}>{icon}</div>
    <div style={{ fontSize: '20px', fontWeight: 700, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    <div style={{ fontSize: '10px', color: colors.silver, letterSpacing: '1px', marginTop: '4px' }}>{label}</div>
  </Card>
)

const Dashboard = ({ data, setActiveTab }) => {
  const { standings, currentWeek, nflState, userMap, rosters } = data
  const { matchups } = useMatchups(currentWeek, userMap, rosters)
  const weeklyHistory = useWeeklyHistory(currentWeek)
  const leader = standings[0]
  const highestPF = standings.length > 0 ? Math.max(...standings.map(s => s.pf)) : 0
  const longestStreak = standings.reduce((max, s) => { const streak = s.streak?.match(/W(\d+)/)?.[1] || 0; return Math.max(max, parseInt(streak) || 0) }, 0)
  const isLive = nflState?.season_type === 'regular'
  
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card style={{ background: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyDark} 50%, ${colors.navyDeep} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', background: `radial-gradient(circle, ${colors.accent}25 0%, transparent 70%)`, borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '11px', color: colors.accent, fontWeight: 600, letterSpacing: '2px', marginBottom: '10px' }}>WEEK {currentWeek} • {nflState?.season || 2024} SEASON</div>
          <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '26px', color: colors.white, margin: '0 0 12px 0', fontWeight: 700 }}>League of Misfits 🛡️</h1>
          <p style={{ color: colors.silver, fontSize: '13px', margin: 0 }}>8 years of dynasty glory • Est. 2017</p>
        </div>
      </Card>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <StatCard icon="👑" value={leader?.name || '...'} label="1ST PLACE" color={colors.gold} />
        <StatCard icon="📊" value={highestPF.toFixed(1)} label="TOP SCORER" color={colors.accent} />
        <StatCard icon="🔥" value={longestStreak || '-'} label="WIN STREAK" color={colors.success} />
        <StatCard icon="⚔️" value={matchups.length} label="MATCHUPS" color={colors.white} />
      </div>
      
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ color: colors.white, fontSize: '15px', margin: 0, fontFamily: "'Oswald', sans-serif" }}>WEEK {currentWeek} MATCHUPS</h2>
          {isLive && <LiveBadge />}
        </div>
        {matchups.length === 0 ? (
          <div style={{ color: colors.silver, textAlign: 'center', padding: '20px' }}>No matchup data</div>
        ) : (
          matchups.slice(0, 3).map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: colors.navyLight + '30', borderRadius: '10px', marginBottom: i < 2 ? '10px' : 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: m.score1 >= m.score2 ? colors.white : colors.silver, fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{m.team1} {m.score1 > m.score2 && '✓'}</div>
                <div style={{ color: m.score1 >= m.score2 ? colors.success : colors.silver, fontSize: '22px', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{m.score1.toFixed(2)}</div>
              </div>
              <div style={{ color: colors.silver, fontSize: '11px', padding: '0 16px', fontWeight: 600 }}>VS</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ color: m.score2 > m.score1 ? colors.white : colors.silver, fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{m.score2 > m.score1 && '✓ '}{m.team2}</div>
                <div style={{ color: m.score2 > m.score1 ? colors.success : colors.silver, fontSize: '22px', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}>{m.score2.toFixed(2)}</div>
              </div>
            </div>
          ))
        )}
        <button onClick={() => setActiveTab('matchups')} style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'transparent', border: `1px solid ${colors.accent}`, borderRadius: '10px', color: colors.accent, fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          View All Matchups <ChevronRight size={16} />
        </button>
      </Card>
      
      {weeklyHistory.length > 0 && (
        <Card>
          <h2 style={{ color: colors.white, fontSize: '15px', marginBottom: '20px', fontFamily: "'Oswald', sans-serif" }}>SCORING TRENDS</h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weeklyHistory}>
              <defs>
                <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.success} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colors.success} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="week" stroke={colors.silver} fontSize={10} tickFormatter={(v) => `W${v}`} />
              <YAxis stroke={colors.silver} fontSize={10} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: colors.navyDark, border: `1px solid ${colors.navyLight}`, borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="high" stroke={colors.success} fill="url(#highGrad)" strokeWidth={2} name="High" />
              <Line type="monotone" dataKey="avg" stroke={colors.accent} strokeWidth={2} dot={false} name="Avg" />
              <Line type="monotone" dataKey="low" stroke={colors.danger} strokeWidth={2} dot={false} name="Low" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

const Standings = ({ data }) => {
  const { standings } = data
  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', color: colors.white, marginBottom: '20px' }}>🏆 STANDINGS</h1>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: colors.navyLight }}>
              <th style={{ padding: '14px 12px', textAlign: 'left', color: colors.silver, fontSize: '10px', fontWeight: 600 }}>#</th>
              <th style={{ padding: '14px 12px', textAlign: 'left', color: colors.silver, fontSize: '10px', fontWeight: 600 }}>TEAM</th>
              <th style={{ padding: '14px 12px', textAlign: 'center', color: colors.silver, fontSize: '10px', fontWeight: 600 }}>REC</th>
              <th style={{ padding: '14px 12px', textAlign: 'right', color: colors.silver, fontSize: '10px', fontWeight: 600 }}>PF</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, i) => (
              <tr key={team.rosterId} style={{ borderBottom: `1px solid ${colors.navyLight}30`, background: i === 0 ? `${colors.gold}08` : 'transparent' }}>
                <td style={{ padding: '16px 12px' }}><span style={{ color: i === 0 ? colors.gold : i < 4 ? colors.success : colors.silver, fontWeight: 700, fontSize: '15px' }}>{team.rank}</span></td>
                <td style={{ padding: '16px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colors.navyLight, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {team.avatar ? <img src={team.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={16} color={colors.silver} />}
                    </div>
                    <div>
                      <div style={{ color: colors.white, fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>{team.name}{i === 0 && <Crown size={14} color={colors.gold} />}</div>
                      {team.streak && <div style={{ color: team.streak.startsWith('W') ? colors.success : colors.danger, fontSize: '11px' }}>{team.streak}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 12px', textAlign: 'center', color: colors.white, fontWeight: 600 }}>{team.wins}-{team.losses}</td>
                <td style={{ padding: '16px 12px', textAlign: 'right', color: colors.accent, fontWeight: 600 }}>{team.pf.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

const Matchups = ({ data }) => {
  const { currentWeek, userMap, rosters } = data
  const [selectedWeek, setSelectedWeek] = useState(currentWeek)
  const { matchups, loading } = useMatchups(selectedWeek, userMap, rosters)
  useEffect(() => { setSelectedWeek(currentWeek) }, [currentWeek])
  
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', color: colors.white, margin: 0 }}>⚔️ MATCHUPS</h1>
        <select value={selectedWeek} onChange={(e) => setSelectedWeek(parseInt(e.target.value))} style={{ background: colors.navyDark, border: `1px solid ${colors.navyLight}`, borderRadius: '8px', padding: '8px 12px', color: colors.white, fontSize: '13px' }}>
          {Array.from({ length: Math.max(currentWeek, 1) }, (_, i) => i + 1).map(w => (<option key={w} value={w}>Week {w}</option>))}
        </select>
      </div>
      {loading ? <LoadingSpinner /> : matchups.length === 0 ? (
        <Card><div style={{ textAlign: 'center', color: colors.silver, padding: '40px' }}>No matchup data</div></Card>
      ) : (
        matchups.map((m, i) => (
          <Card key={i} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: m.score1 >= m.score2 ? colors.white : colors.silver, fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>{m.team1} {m.score1 > m.score2 && <span style={{ color: colors.success }}>✓</span>}</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: m.score1 >= m.score2 ? colors.success : colors.white, fontFamily: "'Oswald', sans-serif" }}>{m.score1.toFixed(2)}</div>
              </div>
              <div style={{ padding: '0 20px', color: colors.silver, fontSize: '13px', fontWeight: 600 }}>VS</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ color: m.score2 > m.score1 ? colors.white : colors.silver, fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>{m.score2 > m.score1 && <span style={{ color: colors.success }}>✓ </span>}{m.team2}</div>
                <div style={{ fontSize: '32px', fontWeight: 700, color: m.score2 > m.score1 ? colors.success : colors.white, fontFamily: "'Oswald', sans-serif" }}>{m.score2.toFixed(2)}</div>
              </div>
            </div>
            <div style={{ marginTop: '16px', height: '6px', background: colors.navyLight, borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(m.score1 / Math.max(m.score1 + m.score2, 1)) * 100}%`, height: '100%', background: m.score1 >= m.score2 ? colors.success : colors.accent }} />
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

const Awards = ({ data }) => {
  const { currentWeek, userMap, rosters } = data
  const [awards, setAwards] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const calculate = async () => {
      setLoading(true)
      const result = []
      for (let w = Math.max(1, currentWeek - 2); w <= currentWeek; w++) {
        const matchups = await api.matchups(w)
        if (!matchups || matchups.length === 0) continue
        const rosterToUser = {}
        rosters?.forEach(r => { rosterToUser[r.roster_id] = userMap[r.owner_id]?.name || `Team ${r.roster_id}` })
        const scores = matchups.map(m => ({ team: rosterToUser[m.roster_id], points: m.points || 0 })).filter(t => t.points > 0)
        if (scores.length === 0) continue
        const top = scores.reduce((max, t) => t.points > max.points ? t : max, scores[0])
        const low = scores.reduce((min, t) => t.points < min.points ? t : min, scores[0])
        result.push({ week: w, topDawg: top, superWeenie: low, horsesAss: { name: low.team, detail: `${low.points.toFixed(2)} pts` } })
      }
      setAwards(result.reverse())
      setLoading(false)
    }
    if (currentWeek && userMap && rosters) calculate()
  }, [currentWeek, userMap, rosters])
  
  return (
    <div style={{ padding: '20px' }}>
      <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', color: colors.white, marginBottom: '20px' }}>🎖️ AWARDS</h1>
      {loading ? <LoadingSpinner /> : awards.length === 0 ? (
        <Card><div style={{ textAlign: 'center', color: colors.silver, padding: '40px' }}>No awards yet</div></Card>
      ) : (
        awards.map((w, i) => (
          <Card key={i} style={{ marginBottom: '20px' }}>
            <div style={{ color: colors.accent, fontSize: '11px', fontWeight: 600, marginBottom: '16px', letterSpacing: '2px' }}>WEEK {w.week}</div>
            <div style={{ padding: '16px', background: `${colors.gold}15`, borderRadius: '12px', borderLeft: `4px solid ${colors.gold}`, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>👑</span>
                <div style={{ flex: 1 }}><div style={{ color: colors.gold, fontSize: '10px', fontWeight: 600 }}>TOP DAWG</div><div style={{ color: colors.white, fontSize: '17px', fontWeight: 700 }}>{w.topDawg.team}</div></div>
                <div style={{ color: colors.gold, fontSize: '18px', fontWeight: 700 }}>{w.topDawg.points.toFixed(1)}</div>
              </div>
            </div>
            <div style={{ padding: '16px', background: `${colors.danger}15`, borderRadius: '12px', borderLeft: `4px solid ${colors.danger}`, marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🌭</span>
                <div style={{ flex: 1 }}><div style={{ color: colors.danger, fontSize: '10px', fontWeight: 600 }}>SUPER WEENIE</div><div style={{ color: colors.white, fontSize: '17px', fontWeight: 700 }}>{w.superWeenie.team}</div></div>
                <div style={{ color: colors.danger, fontSize: '18px', fontWeight: 700 }}>{w.superWeenie.points.toFixed(1)}</div>
              </div>
            </div>
            <div style={{ padding: '16px', background: `${colors.warning}15`, borderRadius: '12px', borderLeft: `4px solid ${colors.warning}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '28px' }}>🐴</span>
                <div style={{ flex: 1 }}><div style={{ color: colors.warning, fontSize: '10px', fontWeight: 600 }}>HORSE'S ASS</div><div style={{ color: colors.white, fontSize: '17px', fontWeight: 700 }}>{w.horsesAss.name}</div><div style={{ color: colors.silver, fontSize: '12px' }}>{w.horsesAss.detail}</div></div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

const AIChat = () => {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hey! I'm your League of Misfits AI 🛡️ Ask about trades, waivers, or roasts!" }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const send = () => {
    if (!input.trim() || loading) return
    setMessages(prev => [...prev, { role: 'user', content: input }])
    setInput('')
    setLoading(true)
    setTimeout(() => {
      const responses = ["Based on recent performance, target high-upside waiver players! 🎯", "That trade looks fair - maybe counter for a little more value 💪", "Ha! That team's bench is outscoring their starters! 😂", "Playoff race is TIGHT - every game matters now! 🔥"]
      setMessages(prev => [...prev, { role: 'assistant', content: responses[Math.floor(Math.random() * responses.length)] }])
      setLoading(false)
    }, 1000)
  }
  
  return (
    <div style={{ padding: '20px', height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '22px', color: colors.white, marginBottom: '16px' }}>🤖 AI CHAT</h1>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '14px 18px', borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: m.role === 'user' ? colors.accent : colors.navyDark, border: m.role === 'user' ? 'none' : `1px solid ${colors.navyLight}`, color: colors.white, fontSize: '14px' }}>{m.content}</div>
        ))}
        {loading && <div style={{ alignSelf: 'flex-start', padding: '14px 18px', borderRadius: '18px 18px 18px 4px', background: colors.navyDark, border: `1px solid ${colors.navyLight}`, color: colors.silver }}>...</div>}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && send()} placeholder="Ask anything..." style={{ flex: 1, padding: '14px 18px', background: colors.navyDark, border: `1px solid ${colors.navyLight}`, borderRadius: '14px', color: colors.white, fontSize: '14px', outline: 'none' }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{ padding: '14px 20px', background: colors.accent, border: 'none', borderRadius: '14px', color: colors.white, cursor: 'pointer' }}><Send size={20} /></button>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const data = useLeagueData()
  
  const renderPage = () => {
    if (data.loading) return <LoadingSpinner />
    if (data.error) return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
        <div style={{ color: colors.danger, marginBottom: '20px' }}>{data.error}</div>
        <button onClick={data.refresh} style={{ padding: '12px 24px', background: colors.accent, border: 'none', borderRadius: '10px', color: colors.white, cursor: 'pointer' }}>Retry</button>
      </div>
    )
    switch(activeTab) {
      case 'dashboard': return <Dashboard data={data} setActiveTab={setActiveTab} />
      case 'standings': return <Standings data={data} />
      case 'matchups': return <Matchups data={data} />
      case 'awards': return <Awards data={data} />
      case 'chat': return <AIChat />
      default: return <Dashboard data={data} setActiveTab={setActiveTab} />
    }
  }
  
  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${colors.navyDark} 0%, ${colors.navyDeep} 100%)`, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${colors.navyLight}; border-radius: 2px; }
        input::placeholder { color: ${colors.silver}80; }
        select option { background: ${colors.navyDark}; }
      `}</style>
      
      <nav style={{ position: 'sticky', top: 0, height: '64px', background: colors.navyDark, borderBottom: `1px solid ${colors.navyLight}40`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: colors.white, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🛡️</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: colors.white, fontFamily: "'Oswald', sans-serif" }}>LEAGUE OF MISFITS</div>
            <div style={{ fontSize: '10px', color: colors.silver, letterSpacing: '1px' }}>EST. 2017</div>
          </div>
        </div>
        <button onClick={data.refresh} disabled={data.loading} style={{ background: 'none', border: 'none', color: colors.silver, cursor: 'pointer', padding: '8px' }}>
          <RefreshCw size={20} style={{ animation: data.loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </nav>
      
      <div style={{ paddingBottom: '80px' }}>{renderPage()}</div>
      
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', background: colors.navyDark, borderTop: `1px solid ${colors.navyLight}40`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 }}>
        {[
          { id: 'dashboard', icon: TrendingUp, label: 'Home' },
          { id: 'standings', icon: Trophy, label: 'Standings' },
          { id: 'matchups', icon: Users, label: 'Matchups' },
          { id: 'awards', icon: Award, label: 'Awards' },
          { id: 'chat', icon: MessageCircle, label: 'AI' },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: activeTab === id ? colors.accent : colors.silver, cursor: 'pointer', padding: '8px 12px' }}>
            <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.5} />
            <span style={{ fontSize: '10px', fontWeight: activeTab === id ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
