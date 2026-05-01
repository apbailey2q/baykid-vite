// DEMO — ScanModal: scan or type a bag code → request pickup → done
import { useState } from 'react'
import { useDemoStore } from '../../store/demoStore'

interface Props {
  consumerName: string
  initialCode?: string   // pre-seeds bag code and skips to requesting phase
  onClose: () => void
}

type Phase = 'scanning' | 'requesting' | 'success'

const A = '#00c8ff'
const S = '#4ade80'
const GL = 'rgba(255,255,255,0.06)'
const BD = 'rgba(0,190,255,0.15)'

function nextBagCode(existing: number): string {
  return `BAG-${new Date().getFullYear()}-${String(existing + 1).padStart(3, '0')}`
}

export default function ScanModal({ consumerName, initialCode, onClose }: Props) {
  const { bags, addBag } = useDemoStore()
  const [phase, setPhase]     = useState<Phase>(initialCode ? 'requesting' : 'scanning')
  const [bagCode, setBagCode] = useState(initialCode ?? '')
  const [address, setAddress] = useState('')
  const [notes, setNotes]     = useState('')
  const [manualCode, setManualCode] = useState('')
  const [useManual, setUseManual]   = useState(false)

  // Capture (camera) or confirm manual code → go directly to requesting
  const capture = () => {
    const code = useManual && manualCode.trim()
      ? manualCode.trim().toUpperCase()
      : nextBagCode(bags.length)
    setBagCode(code)
    setPhase('requesting')
  }

  const requestPickup = () => {
    addBag(bagCode, consumerName, address || '123 Main St, Brooklyn NY', notes)
    setPhase('success')
  }

  const scanAnother = () => {
    setBagCode('')
    setAddress('')
    setNotes('')
    setManualCode('')
    setUseManual(false)
    setPhase('scanning')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(6,14,36,0.96)', backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${BD}` }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
          {phase === 'scanning'   && (useManual ? 'Enter Bag Code' : 'Scan Bag')}
          {phase === 'requesting' && 'Request Pickup'}
          {phase === 'success'    && 'Pickup Requested!'}
        </p>
        <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxWidth: 430, margin: '0 auto', width: '100%' }}>

        {/* ── SCANNING phase ── */}
        {phase === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 20 }}>
            {!useManual ? (
              <>
                {/* Viewfinder */}
                <div style={{
                  position: 'relative', width: 240, height: 240,
                  border: `2px solid ${A}`, borderRadius: 16, overflow: 'hidden',
                  background: 'rgba(0,200,255,0.03)',
                }}>
                  {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
                    <div key={i} style={{
                      position:'absolute',...pos, width:24, height:24,
                      borderTop:    i<2  ? `3px solid ${A}` : undefined,
                      borderBottom: i>=2 ? `3px solid ${A}` : undefined,
                      borderLeft:   i%2===0 ? `3px solid ${A}` : undefined,
                      borderRight:  i%2===1 ? `3px solid ${A}` : undefined,
                    }}/>
                  ))}
                  <div style={{
                    position:'absolute', left:0, right:0, height:2,
                    background:`linear-gradient(90deg,transparent,${A},transparent)`,
                    boxShadow:`0 0 10px ${A}`,
                    animation:'scanLine 1.8s ease-in-out infinite',
                  }}/>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.12}}>
                    <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke={A} strokeWidth="1">
                      <rect x="3" y="3" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/>
                      <rect x="16" y="3" width="5" height="5"/><rect x="9" y="9" width="6" height="6"/>
                      <line x1="3" y1="9" x2="8" y2="9"/><line x1="9" y1="3" x2="9" y2="8"/>
                    </svg>
                  </div>
                </div>
                <p style={{fontSize:13,color:'rgba(255,255,255,0.4)',textAlign:'center'}}>Position QR code inside the frame</p>

                <button
                  onClick={capture}
                  style={{
                    width:'100%', padding:'14px 0', borderRadius:14, border:'none', cursor:'pointer',
                    background:`linear-gradient(135deg,#0057e7,${A})`,
                    color:'#fff', fontSize:15, fontWeight:700,
                    boxShadow:`0 4px 24px rgba(0,190,255,0.35)`,
                  }}
                >
                  📷 Capture Scan
                </button>

                <button
                  onClick={() => setUseManual(true)}
                  style={{ background:'none', border:'none', color:'rgba(0,200,255,0.6)', fontSize:13, cursor:'pointer' }}
                >
                  Enter code manually →
                </button>
              </>
            ) : (
              <div style={{width:'100%',display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6}}>
                    Bag Code
                  </label>
                  <input
                    autoFocus
                    value={manualCode}
                    onChange={e=>setManualCode(e.target.value)}
                    placeholder="Any code — letters, numbers, symbols"
                    style={{
                      width:'100%', padding:'12px 14px', borderRadius:12,
                      background:'rgba(255,255,255,0.05)', border:`1px solid ${BD}`,
                      color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box',
                    }}
                  />
                </div>
                <div style={{display:'flex',gap:10}}>
                  <button
                    onClick={()=>setUseManual(false)}
                    style={{flex:1,padding:'12px 0',borderRadius:12,border:`1px solid ${BD}`,background:GL,color:'rgba(255,255,255,0.4)',fontSize:13,cursor:'pointer'}}
                  >
                    Use Camera
                  </button>
                  <button
                    onClick={capture}
                    disabled={!manualCode.trim()}
                    style={{
                      flex:2, padding:'12px 0', borderRadius:12, border:'none', cursor:'pointer',
                      background:`linear-gradient(135deg,#0057e7,${A})`,
                      color:'#fff', fontSize:14, fontWeight:700, opacity: manualCode.trim() ? 1 : 0.4,
                    }}
                  >
                    Request Pickup →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REQUESTING phase ── */}
        {phase === 'requesting' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{padding:'12px 16px',borderRadius:12,background:GL,border:`1px solid ${BD}`}}>
              <p style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:4}}>BAG CODE</p>
              <p style={{fontSize:15,fontWeight:700,color:A,fontFamily:'monospace'}}>{bagCode}</p>
              <p style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:4}}>Status: Ready for pickup</p>
            </div>

            <div>
              <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6}}>
                Pickup Address
              </label>
              <input
                value={address}
                onChange={e=>setAddress(e.target.value)}
                placeholder="123 Main St, Brooklyn NY"
                style={{
                  width:'100%',padding:'12px 14px',borderRadius:12,boxSizing:'border-box',
                  background:'rgba(255,255,255,0.05)',border:`1px solid ${BD}`,
                  color:'#fff',fontSize:14,outline:'none',
                }}
              />
            </div>

            <div>
              <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:6}}>
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                placeholder="Leave at front door, heavy bag, etc."
                rows={3}
                style={{
                  width:'100%',padding:'12px 14px',borderRadius:12,boxSizing:'border-box',
                  background:'rgba(255,255,255,0.05)',border:`1px solid ${BD}`,
                  color:'#fff',fontSize:14,outline:'none',resize:'none',
                }}
              />
            </div>

            <div style={{display:'flex',gap:10,marginTop:4}}>
              <button
                onClick={onClose}
                style={{flex:1,padding:'13px 0',borderRadius:12,border:`1px solid ${BD}`,background:GL,color:'rgba(255,255,255,0.5)',fontSize:14,cursor:'pointer'}}
              >
                Cancel
              </button>
              <button
                onClick={requestPickup}
                style={{
                  flex:2,padding:'13px 0',borderRadius:12,border:'none',cursor:'pointer',
                  background:`linear-gradient(135deg,#0057e7,${A})`,
                  color:'#fff',fontSize:14,fontWeight:700,
                  boxShadow:`0 4px 20px rgba(0,190,255,0.3)`,
                }}
              >
                Request Pickup
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS phase ── */}
        {phase === 'success' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20,paddingTop:20}}>
            <div style={{
              width:72,height:72,borderRadius:'50%',
              background:'rgba(74,222,128,0.12)',border:`2px solid ${S}`,
              display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 0 28px rgba(74,222,128,0.3)`,
              animation:'badgePop 0.5s ease both',
            }}>
              <span style={{fontSize:34}}>✅</span>
            </div>
            <div style={{textAlign:'center'}}>
              <p style={{fontSize:18,fontWeight:700,color:'#fff'}}>Pickup Request Submitted!</p>
              <p style={{fontSize:13,color:S,marginTop:4}}>A driver will be assigned shortly</p>
            </div>
            <div style={{width:'100%',padding:'14px 18px',borderRadius:16,background:GL,border:`1px solid ${BD}`}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Bag</span>
                <span style={{fontSize:13,fontWeight:700,color:A,fontFamily:'monospace'}}>{bagCode}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Status</span>
                <span style={{fontSize:13,fontWeight:600,color:'#fff'}}>Pending pickup</span>
              </div>
            </div>
            <div style={{display:'flex',gap:10,width:'100%'}}>
              <button
                onClick={scanAnother}
                style={{
                  flex:1,padding:'13px 0',borderRadius:12,border:`1px solid ${BD}`,
                  background:GL,color:A,fontSize:14,fontWeight:600,cursor:'pointer',
                }}
              >
                Scan Another
              </button>
              <button
                onClick={onClose}
                style={{
                  flex:1,padding:'13px 0',borderRadius:12,border:'none',cursor:'pointer',
                  background:`linear-gradient(135deg,#0057e7,${A})`,
                  color:'#fff',fontSize:14,fontWeight:700,
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
