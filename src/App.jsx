import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    onSnapshot, 
    collection, 
    addDoc,
    deleteDoc,
    query,
    orderBy,
} from 'firebase/firestore';
import { ArrowRight, Users, Target, MessageSquare, LogOut, Clipboard, Check, Plus, Trash2, Sparkles, LoaderCircle, Shield, Plane, Edit, Bell, X, Zap, AlertTriangle, Send, Calendar, Trophy } from 'lucide-react';

// --- App Configuration ---
const RANKS = ['Member', 'Motivator', 'Planner'];
const PERMISSIONS = {
    CAN_SEND_ANNOUNCEMENT: ['Motivator', 'Planner'],
    CAN_CREATE_TRIP: ['Planner'],
};

// THIS IS WHERE YOU WILL PASTE YOUR FIREBASE CONFIG OBJECT
const firebaseConfig = {
  apiKey: "AIzaSyB9t4VHVQEMqSuSFcn4lj_atWK1ygkCrlQ",
  authDomain: "hustle-hub-903d0.firebaseapp.com",
  projectId: "hustle-hub-903d0",
  storageBucket: "hustle-hub-903d0.firebasestorage.app",
  messagingSenderId: "883676746429",
  appId: "1:883676746429:web:7937abfe99733c15399dd4",
  measurementId: "G-FG21FTYTPG"
};

// --- Gemini API Helper ---
const callGeminiAPI = async (prompt) => {
    const model = 'gemini-2.0-flash'; 
    const apiKey = ""; // This should be left empty
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`API request failed with status ${response.status}`);
        }
        const result = await response.json();
        if (result.candidates && result.candidates[0]?.content?.parts?.length > 0) {
            return result.candidates[0].content.parts[0].text;
        }
        return "Could not generate a response.";
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "Failed to get a response from the AI.";
    }
};

// --- Configuration Needed Screen ---
const ConfigurationNeededScreen = () => {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-8">
            <div className="w-full max-w-2xl bg-gray-950 rounded-2xl shadow-2xl shadow-red-500/20 p-8 border border-red-500 text-center">
                <div className="flex justify-center mb-4">
                    <AlertTriangle className="text-red-400" size={48} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">Configuration Required</h2>
                <p className="text-gray-300 mb-6 text-lg">
                    This application requires your personal Firebase credentials to connect to the database.
                </p>
                <p className="text-gray-400 mb-8">
                    Please follow the deployment guide to create a Firebase project, get your `firebaseConfig` object, and paste it into this file to replace the placeholder values.
                </p>
                <div className="bg-gray-800 p-4 rounded-lg text-left font-mono text-sm text-gray-300">
                    <p>// Find this code block in your App.jsx file</p>
                    <p><span className="text-red-400">const firebaseConfig = {'{'}</span></p>
                    <p><span className="text-red-400">  apiKey: "YOUR_API_KEY",</span></p>
                    <p><span className="text-red-400">  ...</span></p>
                    <p><span className="text-red-400">{'}'};</span></p>
                    <p className="mt-2">// Replace it with the config from your Firebase project.</p>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [groupId, setGroupId] = useState(localStorage.getItem('hustleHubGroupId') || null);
    const [groupData, setGroupData] = useState(null);
    const [members, setMembers] = useState([]);
    const [goals, setGoals] = useState([]);
    const [messages, setMessages] = useState([]);
    const [trips, setTrips] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [wins, setWins] = useState([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentView, setCurrentView] = useState('dashboard');
    const [notifications, setNotifications] = useState([]);
    
    const isInitialLoad = useRef(true);
    const currentUserProfileRef = useRef(null);
    
    // --- Configuration Check ---
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        return <ConfigurationNeededScreen />;
    }

    // --- Firebase Initialization ---
    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                try {
                    await signInAnonymously(firebaseAuth);
                } catch (err) {
                    console.error("Authentication Error:", err);
                    setError("Failed to authenticate. Please check your Firebase configuration.");
                }
            }
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // --- User-specific computed data ---
    const { currentUserProfile, isLeader } = useMemo(() => {
        if (!user || !groupData) return {};
        const profile = members.find(member => member.id === user.uid);
        currentUserProfileRef.current = profile;
        const isLeader = user?.uid === groupData?.leaderId;
        return { currentUserProfile: profile, isLeader };
    }, [user, members, groupData]);

    // --- Notification Helper ---
    const addNotification = (message) => {
        const id = Date.now();
        setNotifications(prev => [{ id, message }, ...prev].slice(0, 5));
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    // --- Data Fetching and Real-time Listeners ---
    useEffect(() => {
        if (!isAuthReady || !db || !user || !groupId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        isInitialLoad.current = true;

        const createListener = (path, setter, name, isChat = false) => {
            const collectionRef = collection(db, `groups/${groupId}/${path}`);
            const q = isChat ? query(collectionRef, orderBy("createdAt", "asc")) : collectionRef;
            
            return onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 if (!isChat) {
                    setter(data.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                 } else {
                    setter(data);
                 }
                
                if (!isInitialLoad.current) {
                   const changes = snapshot.docChanges();
                   changes.forEach(change => {
                       if (change.type === 'added') {
                           const newDoc = change.doc.data();
                           const creator = newDoc.createdBy || newDoc.author || newDoc.senderName || newDoc.userName;
                           if (creator && creator !== currentUserProfileRef.current?.name) {
                               addNotification(`New ${name}: "${newDoc.text || newDoc.name || newDoc.topic || newDoc.description}"`);
                           }
                       }
                   });
                }
            });
        };
        
        const listeners = [
            onSnapshot(doc(db, `groups`, groupId), (docSnap) => {
                if (docSnap.exists()) setGroupData(docSnap.data());
                else { setError("Group not found."); setGroupId(null); localStorage.removeItem('hustleHubGroupId'); }
            }),
            onSnapshot(collection(db, `groups/${groupId}/members`), (snapshot) => setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            createListener('goals', setGoals, 'goal'),
            createListener('trips', setTrips, 'trip'),
            createListener('messages', setMessages, 'message'),
            createListener('meetings', setMeetings, 'meeting'),
            createListener('wins', setWins, 'win'),
            createListener('chat', setChatMessages, 'chat message', true),
        ];
        
        setTimeout(() => { isInitialLoad.current = false; }, 2500);
        setIsLoading(false);
        return () => listeners.forEach(unsub => unsub());
    }, [isAuthReady, db, user, groupId]);


    const hasPermission = (permission) => {
        if (!currentUserProfile) return false;
        if (isLeader) return true;
        return PERMISSIONS[permission]?.includes(currentUserProfile.rank);
    };

    // --- Event Handlers ---
    const handleCreateGroup = async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
            const newGroupRef = await addDoc(collection(db, `groups`), {
                name: "My Entrepreneur Group", createdAt: new Date(), leaderId: user.uid, prizes: "1st: $100 Amazon Gift Card\n2nd: $50 Starbucks Gift Card"
            });
            await setDoc(doc(db, `groups/${newGroupRef.id}/members`, user.uid), {
                name: "Group Leader", location: "", age: "", businessModel: "", revenue: "0", rank: 'Leader', joinedAt: new Date()
            });
            setGroupId(newGroupRef.id);
            localStorage.setItem('hustleHubGroupId', newGroupRef.id);
            setError('');
        } catch (err) {
            console.error("Error creating group:", err);
            setError("Failed to create the group.");
        }
        setIsLoading(false);
    };

    const handleJoinGroup = async (idToJoin) => {
        const trimmedId = idToJoin.trim();
        if (!db || !user || !trimmedId) return;
        setIsLoading(true);
        try {
            const groupDocRef = doc(db, `groups`, trimmedId);
            const groupDoc = await getDoc(groupDocRef);
            if (groupDoc.exists()) {
                const memberDocRef = doc(db, `groups/${trimmedId}/members`, user.uid);
                const memberDoc = await getDoc(memberDocRef);
                if (!memberDoc.exists()) {
                    await setDoc(memberDocRef, {
                        name: "New Member", location: "", age: "", businessModel: "", revenue: "0", rank: 'Member', joinedAt: new Date()
                    });
                }
                setGroupId(trimmedId);
                localStorage.setItem('hustleHubGroupId', trimmedId);
                setError('');
            } else {
                setError("Group with this ID does not exist. Please double-check the ID.");
            }
        } catch (err) {
            console.error("Error joining group:", err);
            setError("An error occurred while trying to join the group.");
        }
        setIsLoading(false);
    };

    const handleLeaveGroup = () => {
        setGroupId(null);
        setGroupData(null);
        setMembers([]);
        setGoals([]);
        setMessages([]);
        setTrips([]);
        setChatMessages([]);
        setMeetings([]);
        setWins([]);
        localStorage.removeItem('hustleHubGroupId');
        setCurrentView('dashboard');
    };

    const handleUpdateProfile = async (profileData) => {
        if(!db || !user || !groupId) return;
        try {
            await updateDoc(doc(db, `groups/${groupId}/members`, user.uid), profileData);
        } catch (err) {
            console.error("Error updating profile:", err);
            setError("Failed to update profile.");
        }
    };
    
    const dbOperation = async (type, path, data) => {
        if (!db || !user || !groupId) return;
        const groupPath = `groups/${groupId}`;
        try {
            switch (type) {
                case 'add': await addDoc(collection(db, `${groupPath}/${path}`), data); break;
                case 'delete': await deleteDoc(doc(db, `${groupPath}/${path}`)); break;
                case 'updateRank': await updateDoc(doc(db, `${groupPath}/members/${path}`), data); break;
                case 'updateGroup': await updateDoc(doc(db, `groups`, groupId), data); break;
                default: console.error("Unknown db operation type");
            }
        } catch (err) { console.error(`DB operation ${type} failed:`, err); setError(`An error occurred. Please try again.`); }
    };
    
    // --- Render Logic ---
    if (isLoading || !isAuthReady) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><LoaderCircle className="animate-spin h-32 w-32 text-indigo-500"/></div>;
    if (!groupId) return <GroupJoinScreen onCreate={handleCreateGroup} onJoin={handleJoinGroup} error={error} />;
    
    return (
        <div className="flex h-screen bg-gray-900 text-white font-sans relative">
            <NotificationCenter notifications={notifications} onClose={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} />
            <aside className="w-64 bg-gray-950 p-6 flex flex-col justify-between border-r border-gray-800">
                <div>
                    <h1 className="text-2xl font-bold text-indigo-400 mb-2">Hustle Hub</h1>
                    <p className="text-gray-400 text-sm mb-8 flex items-center">
                       <span className="truncate">{groupData?.name}</span>
                        {isLeader && <EditGroupNameModal members={members} onUpdateGroupName={(name) => dbOperation('updateGroup', null, {name})}/>}
                    </p>
                    <nav className="space-y-2">
                        <NavItem icon={<Users size={20} />} label="Dashboard" isActive={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
                        <NavItem icon={<Trophy size={20} />} label="Leaderboard" isActive={currentView === 'leaderboard'} onClick={() => setCurrentView('leaderboard')} />
                        <NavItem icon={<MessageSquare size={20} />} label="Chat" isActive={currentView === 'chat'} onClick={() => setCurrentView('chat')} />
                        <NavItem icon={<Calendar size={20} />} label="Meetings" isActive={currentView === 'meetings'} onClick={() => setCurrentView('meetings')} />
                        <NavItem icon={<Target size={20} />} label="Goals" isActive={currentView === 'goals'} onClick={() => setCurrentView('goals')} />
                        <NavItem icon={<Plane size={20} />} label="Trips" isActive={currentView === 'trips'} onClick={() => setCurrentView('trips')} />
                        <NavItem icon={<Bell size={20} />} label="Motivation" isActive={currentView === 'motivation'} onClick={() => setCurrentView('motivation')} />
                    </nav>
                </div>
                <div>
                    {currentUserProfile && <ProfileButton profile={currentUserProfile} onClick={() => setCurrentView('profile')} isLeader={isLeader} />}
                    <button onClick={handleLeaveGroup} className="w-full mt-2 flex items-center justify-center text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 p-2 rounded-lg transition-colors"><LogOut size={16} className="mr-2" /> Leave Group</button>
                </div>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto flex flex-col">
                <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
                    {currentView === 'dashboard' && <DashboardView members={members} groupId={groupId} isLeader={isLeader} onUpdateRank={(memberId, rank) => dbOperation('updateRank', memberId, {rank})} goals={goals} trips={trips} messages={messages} wins={wins} postSummary={(summary) => dbOperation('add', 'messages', {text: summary, author: 'Hustle Hub AI', type: 'announcement', createdAt: new Date()})} />}
                    {currentView === 'leaderboard' && <LeaderboardView members={members} wins={wins} isLeader={isLeader} prizes={groupData?.prizes || ''} onLogWin={(win) => dbOperation('add', 'wins', {...win, userId: user.uid, userName: currentUserProfile?.name, createdAt: new Date()})} onUpdatePrizes={(prizes) => dbOperation('updateGroup', null, {prizes})} onPostMessage={(data) => dbOperation('add', 'messages', {...data, type: 'announcement', createdAt: new Date()})} />}
                    {currentView === 'chat' && <ChatView messages={chatMessages} user={user} onSendMessage={(text) => dbOperation('add', 'chat', {text, senderId: user.uid, senderName: currentUserProfile?.name, createdAt: new Date() })} />}
                    {currentView === 'meetings' && <MeetingsView meetings={meetings} onAddMeeting={(meeting) => dbOperation('add', 'meetings', {...meeting, createdBy: currentUserProfile?.name, createdAt: new Date()})} onDeleteMeeting={(id) => dbOperation('delete', `meetings/${id}`)} />}
                    {currentView === 'goals' && <GoalsView goals={goals} onAddGoal={(text) => dbOperation('add', 'goals', { text, createdAt: new Date(), createdBy: currentUserProfile?.name || 'A member' })} onDeleteGoal={(id) => dbOperation('delete', `goals/${id}`)}/>}
                    {currentView === 'trips' && <TripsView trips={trips} goals={goals} members={members} canCreate={hasPermission('CAN_CREATE_TRIP')} onAddTrip={(trip) => dbOperation('add', 'trips', {...trip, createdBy: currentUserProfile?.name || 'A member'})} onDeleteTrip={(id) => dbOperation('delete', `trips/${id}`)}/>}
                    {currentView === 'motivation' && <MotivationView messages={messages} canSendAnnouncement={hasPermission('CAN_SEND_ANNOUNCEMENT')} onPostMessage={(data) => dbOperation('add', 'messages', {...data, author: currentUserProfile?.name || 'A member'})} members={members} goals={goals} />}
                    {currentView === 'profile' && <ProfileView profile={currentUserProfile} user={user} goals={goals} onUpdateProfile={handleUpdateProfile} />}
                </div>
            </main>
        </div>
    );
}

// --- Sub-components ---
const NotificationCenter=({notifications,onClose})=> <div className="fixed top-5 right-5 z-50 w-80 space-y-3">{notifications.map(n=>(<div key={n.id} className="bg-indigo-600 text-white p-4 rounded-lg shadow-lg flex items-start gap-4 animate-fade-in-down"><Bell size={20} className="mt-1 flex-shrink-0"/><p className="flex-1 text-sm break-words">{n.message}</p><button onClick={()=>onClose(n.id)} className="flex-shrink-0"><X size={18}/></button></div>))}</div>;
const NavItem=({icon,label,isActive,onClick})=> <button onClick={onClick} className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive?'bg-indigo-500 text-white':'text-gray-300 hover:bg-gray-800'}`}>{icon}<span className="ml-3">{label}</span></button>;
const ProfileButton=({profile,onClick,isLeader})=> <button onClick={onClick} className="w-full text-left p-3 rounded-lg hover:bg-gray-800 transition-colors"><div className="flex items-center justify-between"><p className="font-semibold text-white truncate">{profile?.name}</p>{isLeader&&<Shield size={16} className="text-yellow-400 flex-shrink-0"/>}</div><p className="text-sm text-indigo-400">{profile?.rank}</p></button>;
const GroupJoinScreen=({onCreate,onJoin,error})=>{const [joinId,setJoinId]=useState('');return <div className="bg-gray-900 min-h-screen flex items-center justify-center p-4"><div className="w-full max-w-md bg-gray-950 rounded-2xl shadow-2xl shadow-indigo-500/10 p-8 border border-gray-800"><h2 className="text-3xl font-bold text-center text-white mb-2">Welcome to Hustle Hub</h2><p className="text-center text-gray-400 mb-8">Connect with your entrepreneur friends.</p>{error&&<p className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-6 text-center text-sm">{error}</p>}<div className="space-y-6"><div><div className="flex items-center space-x-3"><input type="text" value={joinId} onChange={e=>setJoinId(e.target.value)} placeholder="Enter Group ID to join" className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/><button onClick={()=>onJoin(joinId)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 flex items-center">Join <ArrowRight size={18} className="ml-2"/></button></div></div><div className="flex items-center my-6"><div className="flex-grow border-t border-gray-700"></div><span className="flex-shrink mx-4 text-gray-500">OR</span><div className="flex-grow border-t border-gray-700"></div></div><button onClick={onCreate} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Create a New Group</button></div></div></div>};
const CopyableId=({id})=>{const [copied,setCopied]=useState(false);const handleCopy=()=>{const t=document.createElement('textarea');t.value=id;document.body.appendChild(t);t.select();try{document.execCommand('copy');setCopied(true);setTimeout(()=>setCopied(false),2000)}catch(e){console.error('Failed to copy ID: ',e)}document.body.removeChild(t)};return <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between"><div className="flex-1 min-w-0"><p className="text-sm text-gray-400">Invite friends with this Group ID:</p><p className="text-lg font-mono text-indigo-300 break-all">{id}</p></div><button onClick={handleCopy} title="Copy Group ID" className={`p-3 rounded-lg transition-colors ml-4 ${copied?'bg-green-600 text-white':'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'}`}>{copied?<Check size={20}/>:<Clipboard size={20}/>}</button></div>};
const DashboardView = ({ members, groupId, isLeader, onUpdateRank, goals, trips, messages, wins, postSummary }) => {const getRankColor=(rank)=>({Member:"text-gray-400",Motivator:"text-green-400",Planner:"text-blue-400",Leader:"text-yellow-400"}[rank]||"text-gray-400");const [isGeneratingSummary,setIsGeneratingSummary]=useState(false);const [weeklySummary,setWeeklySummary]=useState("");const handleGenerateSummary=async()=>{setIsGeneratingSummary(true);setWeeklySummary("");const oneWeekAgo=new Date();oneWeekAgo.setDate(oneWeekAgo.getDate()-7);const recentGoals=goals.filter(g=>(g.createdAt?.toDate()||0)>oneWeekAgo).map(g=>`- Goal set: ${g.text}`).join("\n");const recentMessages=messages.filter(m=>(m.createdAt?.toDate()||0)>oneWeekAgo&&m.type!=="announcement").map(m=>`- Message from ${m.author}: ${m.text}`).join("\n");if(!recentGoals&&!recentMessages){setWeeklySummary("Not enough activity this week to generate a summary.");setIsGeneratingSummary(false);return}const prompt=`You are the community manager for "Hustle Hub". Generate a "Weekly Wins" summary based on the following activity from the last 7 days. Make it exciting, celebratory, and brief (3-4 sentences). Mention a specific highlight if possible.\n\nRecent Activity:\n${recentGoals}\n${recentMessages}\n\nGenerate the summary now.`;const result=await callGeminiAPI(prompt);setWeeklySummary(result);setIsGeneratingSummary(false)};const leaderboardData = useMemo(() => { const totals = members.map(m => ({...m, totalRevenue: wins.filter(w => w.userId === m.id).reduce((sum, w) => sum + Number(w.revenueAmount), 0) })); return totals.sort((a, b) => b.totalRevenue - a.totalRevenue); }, [wins, members]); return <div><h2 className="text-3xl font-bold mb-8 text-white">Group Dashboard</h2><div className="mb-10"><h3 className="text-xl font-semibold text-white mb-4">Group Overview</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-gray-800/50 p-4 rounded-lg"><h4 className="font-bold text-indigo-400 mb-3">Top Earners</h4><div className="space-y-2">{leaderboardData.slice(0,3).map((m,i)=><p key={m.id} className="text-sm text-gray-300 truncate">{i+1}. {m.name} - ${m.totalRevenue.toLocaleString()}</p>)}</div></div><div className="bg-gray-800/50 p-4 rounded-lg"><h4 className="font-bold text-indigo-400 mb-3">Recent Goals</h4><div className="space-y-2">{goals.slice(0,3).map(goal=><p key={goal.id} className="text-sm text-gray-300 truncate">{goal.text}</p>)}</div></div><div className="bg-gray-800/50 p-4 rounded-lg"><h4 className="font-bold text-indigo-400 mb-3">Upcoming Trips</h4><div className="space-y-2">{trips.slice(0,3).map(trip=><p key={trip.id} className="text-sm text-gray-300 truncate">{trip.name}</p>)}</div></div><div className="bg-gray-800/50 p-4 rounded-lg"><h4 className="font-bold text-indigo-400 mb-3">Latest Motivation</h4><div className="space-y-2">{messages.slice(0,3).map(msg=><p key={msg.id} className="text-sm text-gray-300 truncate">{msg.text}</p>)}</div></div></div>{isLeader&&<div className="mt-6"><button onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-600">{isGeneratingSummary?<LoaderCircle size={20} className="mr-2 animate-spin"/>:<Sparkles size={20} className="mr-2"/>}✨ Generate Weekly Wins</button>{weeklySummary&&<div className="mt-4 p-4 bg-gray-900/70 rounded-lg border border-gray-600"><h4 className="font-bold text-teal-300 mb-2">AI-Generated Summary:</h4><p className="whitespace-pre-wrap text-gray-200">{weeklySummary}</p><button onClick={()=>{postSummary(weeklySummary);setWeeklySummary("")}} className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg">Post to Motivation Board</button></div>}</div>}</div><div className="mb-8"><CopyableId id={groupId}/></div><h3 className="text-xl font-semibold text-white mb-4">Members</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{members.map(member=><div key={member.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex flex-col justify-between"><div className="flex-grow"><div className="flex justify-between items-start"><h3 className="text-xl font-bold text-white mb-2">{member.name}</h3><span className={`font-bold ${getRankColor(member.rank)}`}>{member.rank}</span></div><p className="text-indigo-400 font-semibold mb-4">{member.businessModel||"N/A"}</p><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Location</span><span className="font-medium">{member.location||"..."}</span></div><div className="flex justify-between"><span>Age</span><span className="font-medium">{member.age||"..."}</span></div><div className="flex justify-between"><span>Revenue</span><span className="font-medium">${Number(member.revenue||0).toLocaleString()}</span></div></div></div>{isLeader&&member.rank!=="Leader"&&<select value={member.rank} onChange={e=>onUpdateRank(member.id,e.target.value)} className="w-full mt-4 bg-gray-700 border border-gray-600 rounded-lg p-2 text-sm focus:ring-indigo-500">{RANKS.map(r=><option key={r} value={r}>{r}</option>)}</select>}</div>)}</div></div>};
const ProfileView=({profile,onUpdateProfile,user,goals})=>{const [formData,setFormData]=useState(profile||{});const [checkInMsg,setCheckInMsg]=useState('');const [isCheckingIn,setIsCheckingIn]=useState(false);useEffect(()=>{setFormData(profile||{})},[profile]);const handleChange=e=>setFormData({...formData,[e.target.name]:e.target.value});const handleSubmit=e=>{e.preventDefault();onUpdateProfile(formData);alert("Profile updated!")};const handleCheckIn=async()=>{if(!profile)return;setIsCheckingIn(true);setCheckInMsg('');const goalText=goals.slice(0,3).map(g=>g.text).join(', ');const prompt=`Act as an accountability coach for an entrepreneur named ${profile.name}. Their business model is: ${profile.businessModel}. Their recent goals with their group are: ${goalText}. Write a single, personalized, probing question to help them reflect on their weekly progress. Make it encouraging but direct.`;const result=await callGeminiAPI(prompt);setCheckInMsg(result);setIsCheckingIn(false)};if(!profile)return <div>Loading...</div>;return <div><h2 className="text-3xl font-bold mb-6 text-white">Your Profile</h2><div className="max-w-2xl mx-auto bg-gray-800/50 border border-gray-700 rounded-xl p-8"><form onSubmit={handleSubmit} className="space-y-6"><div className="space-y-2"><label className="text-sm font-medium text-gray-300">Name</label><input name="name" value={formData.name||''} onChange={handleChange} className="w-full bg-gray-900 border-gray-600 rounded-lg p-2"/></div><div className="space-y-2"><label className="text-sm font-medium text-gray-300">Location</label><input name="location" value={formData.location||''} onChange={handleChange} className="w-full bg-gray-900 border-gray-600 rounded-lg p-2"/></div><div className="space-y-2"><label className="text-sm font-medium text-gray-300">Age</label><input type="number" name="age" value={formData.age||''} onChange={handleChange} className="w-full bg-gray-900 border-gray-600 rounded-lg p-2"/></div><div className="space-y-2"><label className="text-sm font-medium text-gray-300">Business Model</label><input name="businessModel" value={formData.businessModel||''} onChange={handleChange} className="w-full bg-gray-900 border-gray-600 rounded-lg p-2"/></div><div className="space-y-2"><label className="text-sm font-medium text-gray-300">Revenue</label><input type="number" name="revenue" placeholder="0" value={formData.revenue||''} onChange={handleChange} className="w-full bg-gray-900 border-gray-600 rounded-lg p-2"/></div><button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg">Save Changes</button></form></div>{user?.uid===profile.id&&<div className="max-w-2xl mx-auto mt-8 bg-gray-800/50 border border-gray-700 rounded-xl p-8"><h3 className="text-xl font-bold text-white mb-4">Accountability Check-in</h3><button onClick={handleCheckIn} disabled={isCheckingIn} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 rounded-lg flex items-center justify-center disabled:bg-gray-600">{isCheckingIn?<LoaderCircle className="animate-spin mr-2"/>:<Sparkles className="mr-2"/>}✨ Get my AI Check-in</button>{checkInMsg&&<div className="mt-6 p-4 bg-gray-900/70 rounded-lg border border-gray-600"><p className="whitespace-pre-wrap text-gray-200">{checkInMsg}</p></div>}</div>}</div>};
const GoalsView = ({ goals, onAddGoal, onDeleteGoal }) => {const [newGoal, setNewGoal] = useState(''); const [isProcessing, setIsProcessing] = useState(false); const [suggestedSteps, setSuggestedSteps] = useState([]); const [analysis, setAnalysis] = useState(null);const handleBreakdown = async () => { if (!newGoal.trim()) return; setIsProcessing(true); setAnalysis(null); setSuggestedSteps([]); const prompt = `My entrepreneur group has a new goal: "${newGoal}". Break this goal into a list of 3-5 smaller, actionable steps. The steps should be concise. Do not number them or use markdown. Just provide a raw list of steps separated by a newline character.`; const result = await callGeminiAPI(prompt); setSuggestedSteps(result.split('\n').filter(Boolean)); setIsProcessing(false); };const handleAnalyze = async () => { if (!newGoal.trim()) return; setIsProcessing(true); setSuggestedSteps([]); setAnalysis(null); const prompt = `Act as a business strategist. Our goal is: "${newGoal}". Identify 2 potential risks and 2 unforeseen opportunities. Format your response like this:\nRISKS:\n- Risk 1\n- Risk 2\nOPPORTUNITIES:\n- Opportunity 1\n- Opportunity 2`; const result = await callGeminiAPI(prompt); const risks = result.match(/RISKS:\n(- .+\n?)+/)?.[0].split('\n').slice(1).filter(Boolean) || []; const opportunities = result.match(/OPPORTUNITIES:\n(- .+\n?)+/)?.[0].split('\n').slice(1).filter(Boolean) || []; setAnalysis({ risks, opportunities }); setIsProcessing(false); };return (<div><h2 className="text-3xl font-bold mb-6 text-white">Shared Goals</h2><div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-xl"><h3 className="text-lg font-semibold mb-4 text-white">Add a New Goal</h3><div className="flex items-center gap-4"><input type="text" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="e.g., Launch our new product" className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-3"/><button onClick={() => { onAddGoal(newGoal); setNewGoal(''); setSuggestedSteps([]); setAnalysis(null); }} className="bg-indigo-600 hover:bg-indigo-500 font-bold p-3 rounded-lg flex items-center"><Plus size={20} className="mr-2" />Add</button></div><div className="flex flex-wrap gap-4 mt-4"><button onClick={handleBreakdown} disabled={isProcessing || !newGoal.trim()} className="bg-teal-600 hover:bg-teal-500 font-bold p-3 rounded-lg flex items-center disabled:bg-gray-600 text-sm">{isProcessing ? <LoaderCircle size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}✨ Break it down</button><button onClick={handleAnalyze} disabled={isProcessing || !newGoal.trim()} className="bg-amber-600 hover:bg-amber-500 font-bold p-3 rounded-lg flex items-center disabled:bg-gray-600 text-sm">{isProcessing ? <LoaderCircle size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}✨ Analyze Goal</button></div>{suggestedSteps.length > 0 && (<div className="mt-6"><h4 className="font-semibold text-teal-300 mb-3">Suggested Steps:</h4><div className="flex flex-col gap-2">{suggestedSteps.map((step, index) => (<div key={index} className="bg-gray-900/70 p-3 rounded-lg flex justify-between items-center"><p className="text-gray-200">{step}</p><button onClick={() => onAddGoal(step)} title="Add this step as a goal" className="bg-indigo-500 hover:bg-indigo-400 p-2 rounded-md"><Plus size={16}/></button></div>))}</div></div>)}{analysis && (<div className="mt-6 grid md:grid-cols-2 gap-6"><div className="bg-gray-900/70 p-4 rounded-lg"><h4 className="font-bold text-red-400 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2"/>Risks</h4><ul className="list-disc list-inside text-red-200/80 space-y-1 text-sm">{analysis.risks.map((r,i)=><li key={i}>{r.substring(2)}</li>)}</ul></div><div className="bg-gray-900/70 p-4 rounded-lg"><h4 className="font-bold text-green-400 mb-2 flex items-center"><Zap size={18} className="mr-2"/>Opportunities</h4><ul className="list-disc list-inside text-green-200/80 space-y-1 text-sm">{analysis.opportunities.map((o,i)=><li key={i}>{o.substring(2)}</li>)}</ul></div></div>)}</div><div className="space-y-4">{goals.map(goal => (<div key={goal.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5 flex items-center justify-between"><div><p className="text-white text-lg">{goal.text}</p><p className="text-xs text-gray-400 mt-1">Added by {goal.createdBy}</p></div><button onClick={()=>onDeleteGoal(goal.id)} className="text-gray-500 hover:text-red-500 p-2 rounded-full"><Trash2 size={18}/></button></div>))}</div></div>);};
const TripsView=({trips,goals,members,canCreate,onAddTrip,onDeleteTrip})=>{const [name,setName]=useState('');const [date,setDate]=useState('');const [qualifyingGoals,setQualifyingGoals]=useState([]);const [generatedItinerary,setGeneratedItinerary]=useState({});const [isGenerating,setIsGenerating]=useState(null);const handleAddTrip=()=>{onAddTrip({name,date,qualifyingGoals,createdAt:new Date()});setName('');setDate('');setQualifyingGoals([])};const toggleGoal=goalId=>setQualifyingGoals(prev=>prev.includes(goalId)?prev.filter(id=>id!==goalId):[...prev,goalId]);const handleGenerateItinerary=async trip=>{setIsGenerating(trip.id);const memberInfo=members.map(m=>`- ${m.name}, who runs a ${m.businessModel} business.`).join('\n');const goalInfo=trip.qualifyingGoals.map(gId=>goals.find(g=>g.id===gId)?.text).filter(Boolean).join(', ');const prompt=`We are a group of entrepreneurs planning a trip. Trip Name: ${trip.name}. Trip Date: ${trip.date}. Our group consists of:\n${memberInfo}. The goals we want to celebrate are: ${goalInfo}. Generate a fun but productive 3-day itinerary. Format the output as clean text, using markdown for headers (e.g., ### Day 1).`;const result=await callGeminiAPI(prompt);setGeneratedItinerary(prev=>({...prev,[trip.id]:result}));setIsGenerating(null)};return <div><h2 className="text-3xl font-bold mb-6 text-white">Trips & Events</h2>{canCreate&&<div className="mb-8 p-6 bg-gray-800/50 border-gray-700 rounded-xl space-y-4"><h3 className="text-lg font-semibold">Schedule a New Trip</h3><input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Trip Name (e.g., Miami 2025)" className="w-full bg-gray-900 p-2 rounded"/><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-gray-900 p-2 rounded text-gray-400"/><div><h4 className="font-semibold mb-2">Qualifying Goals</h4><div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-gray-900 rounded">{goals.map(g=><div key={g.id} className="flex items-center"><input type="checkbox" id={`goal-${g.id}`} checked={qualifyingGoals.includes(g.id)} onChange={()=>toggleGoal(g.id)} className="mr-3 h-4 w-4 bg-gray-700 text-indigo-600 border-gray-600 rounded focus:ring-indigo-500"/> <label htmlFor={`goal-${g.id}`}>{g.text}</label></div>)}</div></div><button onClick={handleAddTrip} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-lg w-full">Add Trip</button></div>}<div className="space-y-6">{trips.map(trip=><div key={trip.id} className="bg-gray-800 border border-gray-700 p-5 rounded-lg"><div className="flex justify-between items-center"><h3 className="text-xl font-bold">{trip.name}</h3><span className="font-mono">{trip.date}</span></div><p className="text-gray-400 mt-2">Goals to qualify:</p><ul className="list-disc list-inside ml-4 text-gray-300">{trip.qualifyingGoals.map(id=><li key={id}>{(goals.find(g=>g.id===id)||{}).text}</li>)}</ul><div className="mt-4 flex gap-4">{canCreate&&<button onClick={()=>onDeleteTrip(trip.id)} className="text-red-500 hover:text-red-400 p-2 rounded-lg flex items-center bg-red-900/50"><Trash2 size={16} className="mr-2"/>Delete</button>}{canCreate&&<button onClick={()=>handleGenerateItinerary(trip)} disabled={isGenerating===trip.id} className="bg-teal-600 hover:bg-teal-500 text-white font-bold p-2 rounded-lg flex items-center disabled:bg-gray-600">{isGenerating===trip.id?<LoaderCircle size={16} className="mr-2 animate-spin"/>:<Sparkles size={16} className="mr-2"/>}✨ Generate Itinerary</button>}</div>{generatedItinerary[trip.id]&&<div className="mt-4 p-4 bg-gray-900/70 rounded-lg border border-gray-600"><h4 className="font-bold text-teal-300 mb-2">Suggested Itinerary:</h4><p className="whitespace-pre-wrap text-gray-200">{generatedItinerary[trip.id]}</p></div>}</div>)}</div></div>};
const MotivationView=({messages,canSendAnnouncement,onPostMessage,members,goals})=>{const [newMessage,setNewMessage]=useState('');const [isGenerating,setIsGenerating]=useState(false);const [isAnnouncement,setIsAnnouncement]=useState(false);const handlePost=()=>{onPostMessage({text:newMessage,type:isAnnouncement?'announcement':'standard',createdAt:new Date()});setNewMessage('');setIsAnnouncement(false)};const handleGenerate=async()=>{setIsGenerating(true);const memberInfo=members.map(m=>`- ${m.name} is working on ${m.businessModel}`).join('\n');const goalInfo=goals.slice(0,5).map(g=>`- ${g.text}`).join('\n');const prompt=`You are a motivational coach for a group of young entrepreneurs. Context:\nMembers:\n${memberInfo}\nGoals:\n${goalInfo}\nWrite a short, powerful message (2-3 sentences) for the group. Be inspiring. Do not use hashtags.`;const result=await callGeminiAPI(prompt);setNewMessage(result);setIsGenerating(false)};return <div><h2 className="text-3xl font-bold mb-6">Motivation Board</h2><div className="mb-8 p-6 bg-gray-800/50 rounded-xl border border-gray-700"><textarea value={newMessage} onChange={e=>setNewMessage(e.target.value)} rows="4" placeholder="Share a win, a quote, or some encouragement..." className="w-full bg-gray-900 p-3 rounded border border-gray-600"/>{canSendAnnouncement&&<div className="flex items-center my-3"><input type="checkbox" id="announce" checked={isAnnouncement} onChange={e=>setIsAnnouncement(e.target.checked)} className="mr-3 h-4 w-4 bg-gray-700 text-indigo-600 border-gray-600 rounded focus:ring-indigo-500"/><label htmlFor="announce" className="font-semibold text-indigo-300">Send as Announcement</label></div>}<div className="flex justify-end gap-4 mt-2"><button onClick={handleGenerate} disabled={isGenerating} className="bg-teal-600 hover:bg-teal-500 font-bold p-3 rounded-lg flex items-center disabled:bg-gray-600">{isGenerating?<LoaderCircle className="animate-spin mr-2"/>:<Sparkles className="mr-2"/>}✨ Inspire Us</button><button onClick={handlePost} disabled={!newMessage.trim()} className="bg-indigo-600 hover:bg-indigo-500 font-bold p-3 rounded-lg disabled:bg-gray-600">Post</button></div></div><div className="space-y-4">{messages.map(msg=><div key={msg.id} className={`p-5 rounded-lg border ${msg.type==='announcement'?'bg-indigo-900/50 border-indigo-500 shadow-lg shadow-indigo-500/10':'bg-gray-800 border-gray-700'}`}><p className="whitespace-pre-wrap text-lg text-white">{msg.text}</p><p className="text-xs text-right mt-3 text-gray-400">– {msg.author}</p></div>)}</div></div>};
const EditGroupNameModal=({members,onUpdateGroupName})=>{const [isOpen,setIsOpen]=useState(false);const [newName,setNewName]=useState('');const [suggestions,setSuggestions]=useState([]);const [isGenerating,setIsGenerating]=useState(false);const handleGenerateNames=async()=>{setIsGenerating(true);const businessModels=members.map(m=>m.businessModel).filter(Boolean).join(', ');const prompt=`Our entrepreneur group focuses on these business models: ${businessModels}. Suggest 5 creative, cool, and motivational names for our group. List them separated by newlines.`;const result=await callGeminiAPI(prompt);setSuggestions(result.split('\n').filter(Boolean));setIsGenerating(false)};const handleSave=()=>{if(newName.trim()){onUpdateGroupName(newName.trim());setIsOpen(false)}};return <><button onClick={()=>setIsOpen(true)} className="ml-2 text-gray-500 hover:text-white"><Edit size={16}/></button>{isOpen&&<div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"><div className="bg-gray-900 border border-gray-700 rounded-xl p-8 max-w-md w-full"><h2 className="text-2xl font-bold mb-4">Edit Group Name</h2><input type="text" placeholder="Enter new group name" value={newName} onChange={e=>setNewName(e.target.value)} className="w-full bg-gray-800 p-2 rounded border border-gray-600"/><div className="my-4"><button onClick={handleGenerateNames} disabled={isGenerating} className="w-full text-sm bg-teal-600 hover:bg-teal-500 p-2 rounded flex items-center justify-center disabled:bg-gray-600">{isGenerating?<LoaderCircle className="animate-spin mr-2"/>:<Sparkles className="mr-2"/>} ✨ Suggest Names with AI</button></div>{suggestions.length>0&&<div className="space-y-2 mb-4">{suggestions.map((s,i)=><button key={i} onClick={()=>setNewName(s)} className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded">{s}</button>)}</div>}<div className="flex justify-end gap-4"><button onClick={()=>setIsOpen(false)} className="bg-gray-600 p-2 px-4 rounded">Cancel</button><button onClick={handleSave} className="bg-indigo-600 p-2 px-4 rounded">Save</button></div></div></div>}</>};
const ChatView = ({ messages, user, onSendMessage }) => {const [newMessage, setNewMessage] = useState('');const messagesEndRef = useRef(null);const scrollToBottom = () => {messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });};useEffect(() => {scrollToBottom();}, [messages]);const handleSend = () => {if (newMessage.trim()) {onSendMessage(newMessage.trim());setNewMessage('');}};return (<div className="h-full flex flex-col"><h2 className="text-3xl font-bold mb-6 text-white flex-shrink-0">Group Chat</h2><div className="flex-1 overflow-y-auto bg-gray-800/50 p-4 rounded-t-lg"><div className="space-y-4">{messages.map((msg) => (<div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}><div className={`p-3 rounded-xl max-w-lg ${msg.senderId === user.uid ? 'bg-indigo-600' : 'bg-gray-700'}`}>{msg.senderId !== user.uid && <p className="text-xs font-bold text-indigo-300 mb-1">{msg.senderName}</p>}<p className="text-white">{msg.text}</p></div></div>))}<div ref={messagesEndRef} /></div></div><div className="p-4 bg-gray-800 rounded-b-lg flex items-center gap-4"><input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/><button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-lg flex items-center"><Send size={20} /></button></div></div>);};
const MeetingsView = ({ meetings, onAddMeeting, onDeleteMeeting }) => {
    const [topic, setTopic] = useState('');
    const [agenda, setAgenda] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerateAgenda = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        const prompt = `Act as an expert meeting facilitator. Generate a structured meeting agenda for the topic: "${topic}". Include sections for Introduction (5 mins), key talking points with estimated times, and a wrap-up with action items (10 mins). Keep the total time to about 45-60 minutes. Format it as clean text.`;
        const result = await callGeminiAPI(prompt);
        setAgenda(result);
        setIsGenerating(false);
    };

    const handleSave = () => {
        if (!topic.trim() || !agenda.trim()) return;
        onAddMeeting({ topic, agenda });
        setTopic('');
        setAgenda('');
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6 text-white">Group Meetings</h2>
            <div className="mb-8 p-6 bg-gray-800/50 border border-gray-700 rounded-xl space-y-4">
                <h3 className="text-lg font-semibold text-white">Schedule a New Meeting</h3>
                <div>
                    <label className="text-sm font-medium text-gray-300">Topic</label>
                    <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., Q4 Planning Session" className="w-full mt-1 bg-gray-900 p-2 rounded border border-gray-600" />
                </div>
                <div>
                    <button onClick={handleGenerateAgenda} disabled={isGenerating || !topic.trim()} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg flex items-center disabled:bg-gray-600">
                        {isGenerating ? <LoaderCircle size={20} className="mr-2 animate-spin" /> : <Sparkles size={20} className="mr-2" />}
                        ✨ Generate Agenda with AI
                    </button>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-300">Agenda</label>
                    <textarea value={agenda} onChange={e => setAgenda(e.target.value)} rows="8" placeholder="Agenda details..." className="w-full mt-1 bg-gray-900 p-2 rounded border border-gray-600 font-mono text-sm" />
                </div>
                <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-lg">Save Meeting</button>
            </div>
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white mb-4">Scheduled Meetings</h3>
                {meetings.map(meeting => (
                    <div key={meeting.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xl font-bold text-white">{meeting.topic}</h4>
                            <button onClick={() => onDeleteMeeting(meeting.id)} className="text-gray-500 hover:text-red-500 p-2 rounded-full"><Trash2 size={18} /></button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Created by {meeting.createdBy} on {new Date(meeting.createdAt.seconds * 1000).toLocaleDateString()}</p>
                        <div className="mt-4 p-4 bg-gray-900/50 rounded">
                            <p className="whitespace-pre-wrap text-gray-300">{meeting.agenda}</p>
                        </div>
                    </div>
                ))}
                {meetings.length === 0 && <p className="text-center text-gray-400 py-8">No meetings scheduled yet.</p>}
            </div>
        </div>
    );
};
const LeaderboardView = ({ members, wins, isLeader, prizes, onLogWin, onUpdatePrizes, onPostMessage }) => {
    const [description, setDescription] = useState('');
    const [revenueAmount, setRevenueAmount] = useState('');
    const [prizeText, setPrizeText] = useState(prizes);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(null);

    useEffect(() => {
        if(prizes) setPrizeText(prizes);
    }, [prizes]);

    const leaderboardData = useMemo(() => {
        const userTotals = {};
        members.forEach(member => {
            userTotals[member.id] = { ...member, totalRevenue: wins.filter(w => w.userId === member.id).reduce((sum, w) => sum + Number(w.revenueAmount), 0) };
        });
        return Object.values(userTotals).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [wins, members]);

    const handleLogWin = () => {
        if (!description) return;
        onLogWin({ description, revenueAmount: Number(revenueAmount) || 0 });
        setDescription('');
        setRevenueAmount('');
    };
    
    const handleAnalyzeWin = async (win) => {
        setIsAnalyzing(win.id);
        const prompt = `An entrepreneur, ${win.userName}, just had a win: "${win.description}" which generated $${win.revenueAmount}. Act as a business coach. First, write a short, celebratory message (1-2 sentences). Then, provide one actionable insight or next step they could take based on this win. Format it like this:
        CELEBRATION: [Your celebratory message here]
        INSIGHT: [Your actionable insight here]`;
        const result = await callGeminiAPI(prompt);
        const celebration = result.match(/CELEBRATION: (.*)/)?.[1] || "Great job on the win!";
        const insight = result.match(/INSIGHT: (.*)/)?.[1] || "Keep up the great work.";
        setAnalysisResult({ winId: win.id, celebration, insight });
        setIsAnalyzing(null);
    };
    
    const getRankColor = (rank) => {
        if (rank === 0) return 'border-yellow-400 bg-yellow-400/10';
        if (rank === 1) return 'border-gray-400 bg-gray-400/10';
        if (rank === 2) return 'border-amber-600 bg-amber-600/10';
        return 'border-gray-700';
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6 text-white">Leaderboard & Wins</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    {/* Leaderboard */}
                     <h3 className="text-xl font-semibold text-white mb-4">Revenue Leaderboard</h3>
                    <div className="space-y-3">
                        {leaderboardData.map((member, index) => (
                            <div key={member.id} className={`flex items-center p-4 rounded-lg border-2 ${getRankColor(index)}`}>
                                <span className="text-xl font-bold w-8">{index + 1}</span>
                                {index < 3 && <Trophy size={24} className={index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : 'text-amber-600'} />}
                                <div className="flex-1 ml-4">
                                    <p className="font-bold text-white">{member.name}</p>
                                    <p className="text-sm text-gray-400">{member.rank}</p>
                                </div>
                                <p className="text-xl font-bold text-green-400">${member.totalRevenue.toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8">
                     {/* Log a Win Section */}
                    <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl space-y-4">
                        <h3 className="text-lg font-semibold text-white">Log a New Win</h3>
                        <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your win... (e.g., Closed Client X)" className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                        <input type="number" value={revenueAmount} onChange={e => setRevenueAmount(e.target.value)} placeholder="Revenue Amount (optional)" className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                        <button onClick={handleLogWin} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-lg flex items-center justify-center">
                            <Plus size={20} className="mr-2" /> Log Win
                        </button>
                    </div>

                    {/* Prizes Section */}
                    <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-xl space-y-4">
                        <h3 className="text-lg font-semibold text-white">Leaderboard Prizes</h3>
                        {isLeader ? (
                            <>
                                <textarea value={prizeText} onChange={e => setPrizeText(e.target.value)} rows="3" placeholder="e.g., 1st: $100, 2nd: $50..." className="w-full bg-gray-900 p-2 rounded border border-gray-600" />
                                <button onClick={() => onUpdatePrizes(prizeText)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2 px-4 rounded-lg">Save Prizes</button>
                            </>
                        ) : (
                            <p className="text-gray-300">{prizes || 'No prizes set by the leader yet.'}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-12">
                 <h3 className="text-xl font-semibold text-white mb-4">Recent Wins Feed</h3>
                 <div className="space-y-4">
                    {wins.map(win => (
                        <div key={win.id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                             <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-white"><span className="font-bold text-indigo-300">{win.userName}</span> {win.description}</p>
                                    {win.revenueAmount > 0 && <p className="text-green-400 font-bold">+${Number(win.revenueAmount).toLocaleString()}</p>}
                                    <p className="text-xs text-gray-500 mt-1">{new Date(win.createdAt.seconds * 1000).toLocaleString()}</p>
                                </div>
                                <button onClick={() => handleAnalyzeWin(win)} disabled={isAnalyzing === win.id} className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-1 px-3 rounded-lg flex items-center disabled:bg-gray-600 text-sm">
                                    {isAnalyzing === win.id ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    <span className="ml-2">Analyze</span>
                                </button>
                             </div>
                             {analysisResult?.winId === win.id && (
                                <div className="mt-4 p-4 bg-gray-900/70 rounded-lg border border-teal-500/30">
                                    <p className="text-teal-200 mb-2">{analysisResult.celebration}</p>
                                    <p className="text-gray-300"><span className="font-bold text-teal-300">Next Step:</span> {analysisResult.insight}</p>
                                    <button onClick={() => onPostMessage({author: 'Hustle Hub AI', text: `${analysisResult.celebration}\n\n**Actionable Insight for ${win.userName}:** ${analysisResult.insight}`})} className="mt-3 bg-indigo-600 text-xs py-1 px-3 rounded">Post to Motivation Board</button>
                                </div>
                             )}
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};
