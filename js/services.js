import { collection, doc, addDoc, setDoc, updateDoc, deleteDoc, deleteField, getDoc, getDocs, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./config.js";

// Helpers de Caminho
const getBasePath = () => doc(db, 'artifacts', appId);
const getCol = (name) => collection(getBasePath(), name);

// --- Listeners (Tempo Real) ---

export const subscribeToSectors = (callback) => {
    return onSnapshot(query(getCol('sectors')), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
};

export const subscribeToSupervisors = (callback) => {
    return onSnapshot(query(getCol('supervisors')), (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
};

export const subscribeToEmployees = (sectorId, isSupervisor, callback) => {
    let q = isSupervisor ? query(getCol('employees'), where("sectorId", "==", sectorId)) : query(getCol('employees'));
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    });
};

export const subscribeToLaunches = (month, sectorId, isSupervisor, callback) => {
    if (!month) return () => {};
    let q;
    
    if (isSupervisor) {
        q = query(getCol('launches'), where("monthRef", "==", month), where("sectorId", "==", sectorId));
    } else {
        q = sectorId === 'all' ? 
            query(getCol('launches'), where("monthRef", "==", month)) : 
            query(getCol('launches'), where("monthRef", "==", month), where("sectorId", "==", sectorId));
    }

    return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(), 
            createdAt: d.data().createdAt ? d.data().createdAt.toDate() : new Date() 
        }));
        callback(data);
    }, (error) => {
        console.error("Erro ao buscar lançamentos:", error);
        if (error.code === 'failed-precondition') {
            alert("⚠️ ATENÇÃO: Índice necessário. Abra o console (F12) e clique no link.");
        }
    });
};

// --- Operações CRUD ---

export const saveLaunch = async (data, id = null) => {
    if (id) {
        const dataToUpdate = { ...data };
        delete dataToUpdate.createdAt; 
        return await updateDoc(doc(getCol('launches'), id), dataToUpdate);
    } else {
        return await addDoc(getCol('launches'), { ...data, createdAt: serverTimestamp() });
    }
};

export const deleteItem = async (collectionName, id) => {
    return await deleteDoc(doc(getCol(collectionName), id));
};

// --- VALOR BASE ---

export const updateBaseValue = async (month, value) => {
    return await setDoc(doc(getCol('baseValues'), month), { value: value });
};

// Função de Excluir Valor Base
export const deleteBaseValue = async (month) => {
    return await deleteDoc(doc(getCol('baseValues'), month));
};

export const getBaseValue = async (month) => {
    if (!month) return 0;
    const snap = await getDoc(doc(getCol('baseValues'), month));
    return snap.exists() ? snap.data().value : 0;
};

// --- Login Check ---

export const checkMaster = async () => {
    const snap = await getDoc(doc(db, 'artifacts', appId, 'system', 'master'));
    return snap;
};

export const createMaster = async (username, passwordHash) => {
    await setDoc(doc(db, 'artifacts', appId, 'system', 'master'), { username, passwordHash, createdAt: serverTimestamp() });
};

export const findSupervisor = async (username, passwordHash) => {
    let q = query(getCol('supervisors'), where("username", "==", username), where("passwordHash", "==", passwordHash));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
    return null;
};

// --- Média do Supervisor ---

export const updateSupervisorAvg = async (month, supId, supName, sectorId) => {
    const q = query(getCol('launches'), where("monthRef", "==", month), where("launchedBySupervisor", "==", supId), where("status", "==", ""));
    const snap = await getDocs(q);
    let total = 0, count = 0;
    snap.docs.forEach(d => { if (d.data().type !== 'average') { total += d.data().totalValue; count++; }});

    const avgId = `avg_${supId}_${month.replace('-', '')}`;
    if (count === 0) return await deleteDoc(doc(getCol('launches'), avgId));

    await setDoc(doc(getCol('launches'), avgId), {
        monthRef: month, employeeId: `avg_${supId}`, employeeName: `${supName} (Média Equipe)`,
        sectorId, launchedBy: 'system', launchedBySupervisor: supId, baseValue: 0,
        totalValue: total / count, scores: [], status: "MÉDIA", type: "average", createdAt: serverTimestamp()
    }, { merge: true });
};

export const saveIndices = async (sectorId, indices) => {
    return await updateDoc(doc(getCol('sectors'), sectorId), { indices: indices });
};

export const getChartData = async (employeeId) => {
    const q = query(getCol('launches'), where('employeeId', '==', employeeId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data()).sort((a, b) => a.monthRef.localeCompare(b.monthRef));
};
export const saveGenericItem = async (collectionName, data, id = null) => {
    if (id) {
        // Atualizar existente
        return await updateDoc(doc(getCol(collectionName), id), data);
    } else {
        // Criar novo (Adiciona createdAt se não tiver)
        return await addDoc(getCol(collectionName), { ...data, createdAt: serverTimestamp() });
    }
};
// NOVA FUNÇÃO: Atualizar senha do Master
export const updateMasterPassword = async (newHash) => {
    return await updateDoc(doc(db, 'artifacts', appId, 'system', 'master'), { passwordHash: newHash });
};
