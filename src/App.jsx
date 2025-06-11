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

// --- Helper & UI Components ---
const ConfigurationNeededScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white p-8">
        <div className="w-full max-w-2xl bg-gray-950 rounded-2xl shadow-2xl shadow-red-500/20 p-8 border border-red-500 text-center">
            <div className="flex justify-center mb-4"><AlertTriangle className="text-red-400" size={48} /></div>
            <h2 className="text-3xl font-bold text-white mb-4">Configuration Required</h2>
            <p className="text-gray-300 mb-6 text-lg">This application requires your personal Firebase credentials to connect to the database.</p>
            <p className="text-gray-400 mb-8">Please follow the deployment guide to create a Firebase project, get your `firebaseConfig` object, and paste it into this file to replace the placeholder values.</p>
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
const NotificationCenter=({notifications,onClose})=> <div className="fixed top-5 right-5 z-50 w-80 space-y-3">{notifications.map(n=>(<div key={n.id} className="bg-indigo-600 text-white p-4 rounded-lg shadow-lg flex items-start gap-4 animate-fade-in-down"><Bell size={20} className="mt-1 flex-shrink-0"/><p className="flex-1 text-sm break-words">{n.message}</p><button onClick={()=>onClose(n.id)} className="flex-shrink-0"><X size={18}/></button></div>))}</div>;
const NavItem=({icon,label,isActive,onClick})=> <button onClick={onClick} className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isActive?'bg-indigo-500 text-white':'text-gray-300 hover:bg-gray-800'}`}>{icon}<span className="ml-3">{label}</span></button>;
const ProfileButton=({profile,onClick,isLeader})=> <button onClick={onClick} className="w-full text-left p-3 rounded-lg hover:bg-gray-800 transition-colors"><div className="flex items-center justify-between"><p className="font-semibold text-white truncate">{profile?.name}</p>{isLeader&&<Shield size={16} className="text-yellow-400 flex-shrink-0"/>}</div><p className="text-sm text-indigo-400">{profile?.rank}</p></button>;
const GroupJoinScreen=({onCreate,onJoin,error})=>{const [joinId,setJoinId]=useState('');return <div className="bg-gray-900 min-h-screen flex items-center justify-center p-4"><div className="w-full max-w-md bg-gray-950 rounded-2xl shadow-2xl shadow-indigo-500/10 p-8 border border-gray-800"><h2 className="text-3xl font-bold text-center text-white mb-2">Welcome to Hustle Hub</h2><p className="text-center text-gray-400 mb-8">Connect with your entrepreneur friends.</p>{error&&<p className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-6 text-center text-sm">{error}</p>}<div className="space-y-6"><div><div className="flex items-center space-x-3"><input type="text" value={joinId} onChange={e=>setJoinId(e.target.value)} placeholder="Enter Group ID to join" className="flex-1 bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition"/><button onClick={()=>onJoin(joinId)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 flex items-center">Join <ArrowRight size={18} className="ml-2"/></button></div></div><div className="flex items-center my-6"><div className="flex-grow border-t border-gray-700"></div><span className="flex-shrink mx-4 text-gray-500">OR</span><div className="flex-grow border-t border-gray-700"></div></div><button onClick={onCreate} className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">Create a New Group</button></div></div></div>};
const CopyableId=({id})=>{const [copied,setCopied]=useState(false);const handleCopy=()=>{const t=document.createElement('textarea');t.value=id;document.body.appendChild(t);t.select();try{document.execCommand('copy');setCopied(true);setTimeout(()=>setCopied(false),2000)}catch(e){console.error('Failed to copy ID: ',e)}document.body.removeChild(t)};return <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between"><div className="flex-1 min-w-0"><p className="text-sm text-gray-400">Invite friends with this Group ID:</p><p className="text-lg font-mono text-indigo-300 break-all">{id}</p></div><button onClick={handleCopy} title="Copy Group ID" className={`p-3 rounded-lg transition-colors ml-4 ${copied?'bg-green-600 text-white':'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'}`}>{copied?<Check size={20}/>:<Clipboard size={20}/>}</button></div>};
const DashboardView = ({ members, groupId, isLeader, onUpdateRank, goals, trips, messages, wins, postSummary }) => {/* ... Omitted for brevity ... */};
const ProfileView=({profile,onUpdateProfile,user,goals})=>{/* ... Omitted for brevity ... */};
const GoalsView = ({ goals, onAddGoal, onDeleteGoal }) => {/* ... Omitted for brevity ... */};
const TripsView=({trips,goals,members,canCreate,onAddTrip,onDeleteTrip})=>{/* ... Omitted for brevity ... */};
const MotivationView=({messages,canSendAnnouncement,onPostMessage,members,goals})=>{/* ... Omitted for brevity ... */};
const EditGroupNameModal=({members,onUpdateGroupName})=>{/* ... Omitted for brevity ... */};
const ChatView = ({ messages, user, onSendMessage }) => {/* ... Omitted for brevity ... */};
const MeetingsView = ({ meetings, onAddMeeting, onDeleteMeeting }) => {/* ... Omitted for brevity ... */};
const LeaderboardView = ({ members, wins, isLeader, prizes, onLogWin, onUpdatePrizes, onPostMessage }) => {/* ... Omitted for brevity ... */};


// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [services, setServices] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [initError, setInitError] = useState(null);

    const [groupId, setGroupId] = useState(localStorage.getItem('hustleHubGroupId') || null);
    const [groupData, setGroupData] = useState(null);
    const [members, setMembers] = useState([]);
    const [goals, setGoals] = useState([]);
    const [messages, setMessages] = useState([]);
    const [trips, setTrips] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [wins, setWins] = useState([]);
    
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
        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            setServices({ auth, db });

            const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                if (currentUser) {
                    setUser(currentUser);
                } else {
                    await signInAnonymously(auth);
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (err) {
            console.error("Firebase Initialization Error:", err);
            setInitError("Could not connect to the database. Please check your Firebase configuration.");
        }
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
        setTimeout(() => { setNotifications(prev => prev.filter(n => n.id !== id))}, 5000);
    };

    // --- Data Fetching and Real-time Listeners ---
    useEffect(() => {
        if (!isAuthReady || !services?.db || !user || !groupId) {
            return;
        }
        isInitialLoad.current = true;
        
        const createListener = (path, setter, name, isChat = false) => {
            const collectionRef = collection(services.db, `groups/${groupId}/${path}`);
            const q = isChat ? query(collectionRef, orderBy("createdAt", "asc")) : collectionRef;
            return onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                 if (!isChat) { setter(data.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))); } 
                 else { setter(data); }
                if (!isInitialLoad.current) {
                   snapshot.docChanges().forEach(change => {
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
            onSnapshot(doc(services.db, `groups`, groupId), (docSnap) => {
                if (docSnap.exists()) setGroupData(docSnap.data());
                else { setGroupId(null); localStorage.removeItem('hustleHubGroupId'); }
            }),
            onSnapshot(collection(services.db, `groups/${groupId}/members`), (snapshot) => setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            createListener('goals', setGoals, 'goal'),
            createListener('trips', setTrips, 'trip'),
            createListener('messages', setMessages, 'message'),
            createListener('meetings', setMeetings, 'meeting'),
            createListener('wins', setWins, 'win'),
            createListener('chat', setChatMessages, 'chat message', true),
        ];
        
        setTimeout(() => { isInitialLoad.current = false; }, 2500);
        return () => listeners.forEach(unsub => unsub());
    }, [isAuthReady, services, user, groupId]);


    const hasPermission = (permission) => {
        if (!currentUserProfile) return false;
        if (isLeader) return true;
        return PERMISSIONS[permission]?.includes(currentUserProfile.rank);
    };

    // --- Event Handlers ---
    const handleCreateGroup = async () => {
        if (!services?.db || !user) return;
        try {
            const newGroupRef = await addDoc(collection(services.db, `groups`), {
                name: "My Entrepreneur Group", createdAt: new Date(), leaderId: user.uid, prizes: "1st: $100 Amazon Gift Card\n2nd: $50 Starbucks Gift Card"
            });
            await setDoc(doc(services.db, `groups/${newGroupRef.id}/members`, user.uid), {
                name: "Group Leader", location: "", age: "", businessModel: "", revenue: "0", rank: 'Leader', joinedAt: new Date()
            });
            setGroupId(newGroupRef.id);
            localStorage.setItem('hustleHubGroupId', newGroupRef.id);
        } catch (err) { console.error("Error creating group:", err); }
    };

    const handleJoinGroup = async (idToJoin) => {
        const trimmedId = idToJoin.trim();
        if (!services?.db || !user || !trimmedId) return;
        try {
            const groupDocRef = doc(services.db, `groups`, trimmedId);
            const groupDoc = await getDoc(groupDocRef);
            if (groupDoc.exists()) {
                const memberDocRef = doc(services.db, `groups/${trimmedId}/members`, user.uid);
                const memberDoc = await getDoc(memberDocRef);
                if (!memberDoc.exists()) {
                    await setDoc(memberDocRef, {
                        name: "New Member", location: "", age: "", businessModel: "", revenue: "0", rank: 'Member', joinedAt: new Date()
                    });
                }
                setGroupId(trimmedId);
                localStorage.setItem('hustleHubGroupId', trimmedId);
            } else { setError("Group with this ID does not exist."); }
        } catch (err) { console.error("Error joining group:", err); }
    };

    const handleLeaveGroup = () => {
        setGroupId(null); localStorage.removeItem('hustleHubGroupId'); setCurrentView('dashboard');
    };

    const handleUpdateProfile = async (profileData) => {
        if(!services?.db || !user || !groupId) return;
        try {
            await updateDoc(doc(services.db, `groups/${groupId}/members`, user.uid), profileData);
        } catch (err) { console.error("Error updating profile:", err); }
    };
    
    const dbOperation = async (type, path, data) => {
        if (!services?.db || !user || !groupId) return;
        const groupPath = `groups/${groupId}`;
        try {
            switch (type) {
                case 'add': await addDoc(collection(services.db, `${groupPath}/${path}`), data); break;
                case 'delete': await deleteDoc(doc(services.db, `${groupPath}/${path}`)); break;
                case 'updateRank': await updateDoc(doc(services.db, `${groupPath}/members/${path}`), data); break;
                case 'updateGroup': await updateDoc(doc(services.db, `groups`, groupId), data); break;
                default: console.error("Unknown db operation type");
            }
        } catch (err) { console.error(`DB operation ${type} failed:`, err); }
    };
    
    // --- Render Logic ---
    if (initError) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center"><AlertTriangle size={48} className="mx-auto text-red-500"/>
    <h2 className="mt-4 text-2xl font-bold">{initError}</h2></div></div>;

    if (!isAuthReady) return <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><LoaderCircle className="animate-spin h-32 w-32 text-indigo-500"/></div>;
    
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
