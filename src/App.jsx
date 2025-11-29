import React, { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Trophy, TrendingUp, Users, MessageCircle, Award, ChevronRight, Send, User, RefreshCw, Crown } from 'lucide-react'

// ============== CONFIGURATION ==============
// 🟢 CONNECTED TO YOUR REPLIT BRAIN
const API_URL = "https://06d6146e-e71d-4d54-9582-e6ad83246287-00-300von4iznsch.picard.replit.dev:8080"
const LEAGUE_ID = "1258131568132624384"

// 🟢 SET TO TRUE TO USE PYTHON LOGIC
const USE_BACKEND_API = true 

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

// ============== API LAYER ==============
const sleeperApi = {
  base: 'https://api.sleeper.app/v1',
  async get(endpoint) {
    try {
      const res = await fetch(`${this.base}${endpoint}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      console.error(`Sleeper API Error: ${endpoint}`, e)
      return null
    }
  },
  nflState: () => sleeperApi.get('/state/nfl'),
  league: () => sleeperApi.get(`/league/${LEAGUE_ID}`),
  users: () => sleeperApi.get(`/league/${LEAGUE_ID}/users`),
  rosters: () => sleeperApi.get(`/league/${LEAGUE_ID}/rosters`),
  matchups: (week) => sleeperApi.get(`/league/${LEAGUE_ID}/matchups/${week}`),
}

const backendApi = {
  async get(endpoint) {
    try {
      // Remove trailing slash if present in API_URL to avoid double slashes
      const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
      const res = await fetch(`${baseUrl}${endpoint}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      console.error(`Backend API Error: ${endpoint}`, e)
      return null
    }
  },
  state: () => backendApi.get('/api/state'),
  standings: () => backendApi.get('/api/standings'),
  matchups: (week) => backendApi.get(`/api/matchups/${week}`),
  awards: (week) => backendApi.get(`/api/awards/${week}`),
  weeklyHistory: () => backendApi.get('/api/history/weekly'),
}

// ============== DATA HOOKS ==============
function useLeagueData() {
  const [data, setData] = useState({ 
    loading: true, 
    error: null, 
    nflState: null, 
    standings: [], 
    currentWeek: 1, 
    userMap: {}, 
    rosters: [] 
  })
  
  const refresh = useCallback(async () => {
    setData(d => ({ ...d, loading: true, error: null }))
    try {
      if (USE_BACKEND_API) {
        // --- PATH A: USE PYTHON BRAIN ---
        const [state, standingsData] = await Promise.all([
          backendApi.state(),
          backendApi.standings()
        ])
        
        if (!state || !standingsData) throw new Error('Failed to connect to Python Brain')
        
        // Map standings for UI compatibility
        const standings = standingsData.map((s, i) => ({
          ...s,
          rank: i + 1,
          pf: s.points_for // Ensure compatibility with existing components
        }));

        setData({ 
          loading: false, 
          error: null, 
          nflState: state, 
          standings, 
          currentWeek: state.week || 1, 
          userMap: {}, // Not strictly needed for backend path
          rosters: [] 
        })
      } else {
        // --- PATH B: DIRECT SLEEPER (Fallback) ---
        const [nflState, users, rosters] = await Promise.all([
          sleeperApi.nflState(), 
          sleeperApi.users(), 
          sleeperApi.rosters()
        ])
        if (!nflState || !users || !rosters) throw new Error('Failed to fetch league data')
        
        const userMap = {}
        users.forEach(u => { 
          userMap[u.user_id] = { 
            name: u.display_name || u.username || 'Unknown', 
            avatar: u.avatar ? `https://sleepercdn.com/avatars/thumbs/${u.avatar}` : null 
          } 
        })
        
        const standings = rosters
          .map(r => ({ 
            name: userMap[r.owner_id]?.name || `Team ${r.roster_id}`, 
            avatar: userMap[r.owner_id]?.avatar, 
            wins: r.settings?.wins || 0, 
            losses: r.settings?.losses || 0, 
            pf: (r.settings?.fpts || 0) + (r.settings?.fpts_decimal || 0) / 100, 
            pa: (r.settings?.fpts_against || 0) + (r.settings?.fpts_against_decimal || 0) / 100, 
            rosterId: r.roster_id, 
            ownerId: r.owner_id, 
            streak: r.metadata?.streak || '' 
          }))
          .sort((a, b) => b.wins !== a.wins ? b.wins - a.wins : b.pf - a.pf)
          .map((t, i) => ({ ...t, rank: i + 1 }))
        
        setData({ 
          loading: false, 
          error: null, 
          nflState, 
          standings, 
          currentWeek: nflState.week || 1, 
          userMap, 
          rosters 
        })
      }
    } catch (e) { 
      setData(d => ({ ...d, loading: false, error: e.message })) 
    }
  }, [])
  
  useEffect(() => { refresh() }, [refresh])
  return { ...data, refresh }
}

function useMatchups(week) {
  const [matchups, setMatchups] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!week) return
    setLoading(true)
    
    const fetchMatchups = async () => {
      if (USE_BACKEND_API) {
        // Fetch from Python API
        const data = await backendApi.matchups(week)
        if (data && Array.isArray(data)) {
          // Transform nested Python structure to flat UI structure
          const formatted = data.map(m => ({
            team1: m.team1.team,
            score1: m.team1.score,
            team2: m.team2.team,
            score2: m.team2.score
          }))
          setMatchups(formatted)
        } else {
          setMatchups([])
        }
      } else {
        // Fallback logic
        const matchupsData = await sleeperApi.matchups(week)
        // ... (simplified fallback logic would go here if needed)
        setMatchups([]) 
      }
      setLoading(false)
    }
    
    fetchMatchups()
  }, [week])
  
  return { matchups, loading }
}

function useWeeklyHistory(currentWeek) {
  const [history, setHistory] = useState([])
  
  useEffect(() => {
    if (!currentWeek || currentWeek < 1) return
    
    const fetchHistory = async () => {
      if (USE_BACKEND_API) {
        // This endpoint isn't fully implemented in api.py yet, strictly speaking
        // But if you added it, it would work here. 
        // For now, we'll leave it empty to prevent crashes if endpoint missing
        try {
           const data = await backendApi.weeklyHistory()
           if (data) setHistory(data)
        } catch (e) { console.log("History endpoint not ready yet") }
      }
    }
    fetchHistory()
  }, [currentWeek])
  
  return history
}

function useAwards(currentWeek) {
  const [awards, setAwards] = useState([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!currentWeek) return
    setLoading(true)
    
    const fetchAwards = async () => {
      const result = []
      
      // Fetch last 3 weeks of awards
      for (let w = Math.max(1, currentWeek - 2); w <= currentWeek; w++) {
        if (USE_BACKEND_API) {
          const weekAwards = await backendApi.awards(w)
          
          if (weekAwards && weekAwards.length > 0) {
            // Map Python API response to UI State
            const topDawg = weekAwards.find(a => a.title.includes('Top Dawg'))
            const superWeenie = weekAwards.find(a => a.title.includes('Super Weenie'))
            const horsesAss = weekAwards.find(a => a.title.includes('Horse'))
            
            result.push({
              week: w,
              topDawg: topDawg ? { 
                team: topDawg.winner, 
                points: topDawg.detail 
              } : null,
              superWeenie: superWeenie ? { 
                team: superWeenie.winner, 
                points: superWeenie.detail 
              } : null,
              horsesAss: horsesAss ? { 
                title: horsesAss.title.replace("🐴 Horse's Ass: ", "").replace("🐴 Horses Ass: ", ""),
                team: horsesAss.winner, 
                reason: horsesAss.detail 
              } : null
            })
          }
        }
      }
      
      setAwards(result.reverse())
      setLoading(false)
    }
    
    fetchAwards()
  }, [currentWeek])
  
  return { awards, loading }
}

// ============== COMPONENTS ==============
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

// ============== PAGES ==============
const Dashboard = ({ data, setActiveTab }) => {
  const { standings, currentWeek, nflState } = data
  const { matchups } = useMatchups(currentWeek)
  const weeklyHistory = useWeeklyHistory(currentWeek)
  const leader = standings[0]
  const highestPF = standings.length > 0 ? Math.max(...standings.map(s => s.points_for || s.pf || 0)) : 0
  const longestStreak = standings.reduce((max, s) => { const streak = s.streak?.match(/W(\d+)/)?.[1] || 0; return Math.max(max, parseInt(streak) || 0) }, 0)
  const isLive = nflState?.season_type === 'regular'
  
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card style={{ background: `linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyDark} 50%, ${colors.navyDeep} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', background: `radial-gradient(circle, ${colors.accent}25 0%, transparent 70%)`, borderRadius: '50%' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '11px', color: colors.accent, fontWeight: 600, letterSpacing: '2px', marginBottom: '10px' }}>WEEK {currentWeek} • {nflState?.season || 2024} SEASON</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <img src="/logo1.png" alt="League of Misfits" style={{ height: '50px', width: 'auto' }} />
            <h1 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '26px', color: colors.white, margin: 0, fontWeight: 700 }}>League of Misfits 🛡️</h1>
          </div>
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
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: colors.white, margin: 0 }}>⚔️ THIS WEEK'S MATCHUPS</h2>
          {isLive && <LiveBadge />}
        </div>
        {matchups.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {matchups.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: colors.navyLight + '20', borderRadius: '8px' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.white }}>{m.team1}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: colors.accent }}>{m.score1.toFixed(1)}</div>
                </div>
                <div style={{ textAlign: 'center', color: colors.silver, fontSize: '12px', fontWeight: 600 }}>VS</div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.white }}>{m.team2}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: colors.accent }}>{m.score2.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: colors.silver, textAlign: 'center', margin: 0 }}>No matchups yet</p>
        )}
      </Card>
    </div>
  )
}

const Standings = ({ data }) => {
  const { standings, nflState } = data
  
  return (
    <div style={{ padding: '20px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Card style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: colors.white, margin: '0 0 12px 0' }}>📊 LEAGUE STANDINGS</h2>
        <div style={{ fontSize: '13px', color: colors.silver, marginBottom: '8px' }}>WEEK {nflState?.week || 1} • {nflState?.season || 2024} SEASON</div>
      </Card>
      {standings.map((s, i) => (
        <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: i === 0 ? colors.gold : colors.silver, minWidth: '30px' }}>{s.rank}.</div>
          {s.avatar && <img src={s.avatar} alt={s.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: colors.white }}>{s.name}</div>
            <div style={{ fontSize: '11px', color: colors.silver }}>
              {s.wins}W - {s.losses}L • {(s.points_for || s.pf || 0).toFixed(1)} PF
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: colors.accent }}>{(s.points_for || s.pf || 0).toFixed(0)}</div>
            <div style={{ fontSize: '10px', color: colors.silver }}>pts</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

const Matchups = ({ data }) => {
  const [week, setWeek] = useState(data.currentWeek || 1)
  const { matchups } = useMatchups(week)
  
  return (
    <div style={{ padding: '20px', paddingBottom: '100px' }}>
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setWeek(Math.max(1, week - 1))} style={{ background: colors.navyLight, border: 'none', color: colors.white, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>← PREV</button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: colors.accent }}>WEEK {week}</span>
          <button onClick={() => setWeek(week + 1)} style={{ background: colors.navyLight, border: 'none', color: colors.white, padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>NEXT →</button>
        </div>
      </Card>
      {matchups.length > 0 ? (
        matchups.map((m, i) => (
          <Card key={i} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.white, marginBottom: '4px' }}>{m.team1}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: colors.accent }}>{m.score1.toFixed(1)}</div>
              </div>
              <div style={{ textAlign: 'center', color: colors.silver }}>VS</div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: colors.white, marginBottom: '4px' }}>{m.team2}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: colors.accent }}>{m.score2.toFixed(1)}</div>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: colors.silver, margin: 0 }}>No matchups for week {week}</p>
        </Card>
      )}
    </div>
  )
}

const Awards = ({ data }) => {
  const { awards, loading } = useAwards(data.currentWeek)
  
  return (
    <div style={{ padding: '20px', paddingBottom: '100px' }}>
      {loading ? (
        <LoadingSpinner />
      ) : awards.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: colors.silver, margin: 0 }}>No awards data available</p>
        </Card>
      ) : (
        awards.map((week, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <Card style={{ marginBottom: '12px', background: `linear-gradient(135deg, ${colors.navyLight} 0%, ${colors.navy} 100%)` }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: colors.accent, margin: '0 0 12px 0' }}>WEEK {week.week}</h3>
              {week.topDawg && (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${colors.navyLight}` }}>
                  <div style={{ fontSize: '11px', color: colors.silver, marginBottom: '4px' }}>🏆 TOP DAWG</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.gold }}>{week.topDawg.team}</div>
                  <div style={{ fontSize: '11px', color: colors.accent }}>{week.topDawg.points} points</div>
                </div>
              )}
              {week.superWeenie && (
                <div style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${colors.navyLight}` }}>
                  <div style={{ fontSize: '11px', color: colors.silver, marginBottom: '4px' }}>🌭 SUPER WEENIE</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.danger }}>{week.superWeenie.team}</div>
                  <div style={{ fontSize: '11px', color: colors.accent }}>{week.superWeenie.points} points</div>
                </div>
              )}
              {week.horsesAss && (
                <div>
                  <div style={{ fontSize: '11px', color: colors.silver, marginBottom: '4px' }}>🐴 HORSE'S ASS</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: colors.warning }}>{week.horsesAss.team}</div>
                  <div style={{ fontSize: '11px', color: colors.silver }}>{week.horsesAss.reason}</div>
                </div>
              )}
            </Card>
          </div>
        ))
      )}
    </div>
  )
}

const AIChat = () => {
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hey! I'm your League of Misfits AI 🛡️ Ask about trades, waivers, or roasts!" }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_KEY}` },
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [...messages, userMsg], max_tokens: 150 })
      })
      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || "I couldn't process that. Try again!"
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Connection error. Check your API key!' }])
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{ padding: '20px', paddingBottom: '100px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '80%', background: msg.role === 'user' ? colors.accent : colors.navyLight, color: colors.white, padding: '12px 16px', borderRadius: '12px', fontSize: '13px', wordWrap: 'break-word' }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', gap: '8px' }}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
          placeholder="Ask me anything..." 
          style={{ flex: 1, background: colors.navyLight, border: `1px solid ${colors.navyLight}`, color: colors.white, padding: '10px 12px', borderRadius: '8px', fontSize: '13px', outline: 'none' }} 
        />
        <button 
          onClick={handleSend} 
          disabled={loading} 
          style={{ background: colors.accent, border: 'none', color: colors.white, padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
          {loading ? '...' : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}

// ============== MAIN APP ==============
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const data = useLeagueData()
  
  const renderPage = () => {
    switch (activeTab) {
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
          <img src="/logo1.png" alt="League of Misfits" style={{ height: '40px', width: 'auto' }} />
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
