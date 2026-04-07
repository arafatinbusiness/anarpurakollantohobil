import React, { useState, useEffect } from 'react';
import { UserPlus, DollarSign, Settings, Save, X, Plus, Trash2, Users, ChevronRight, Info, History, Clock, Receipt, Calculator } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs, serverTimestamp, setDoc, onSnapshot } from 'firebase/firestore';
import { User, Funding, FundInfo, Log, Expense, PendingAdmin } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ExpenseForm } from './ExpenseForm';
import { parseNumericInput, normalizeNumericInput } from '../utils/numericUtils';

interface AdminPanelProps {
  users: User[];
  fundings: Funding[];
  fundInfo: FundInfo | null;
  currentAdmin: any;
  expenses?: Expense[]; // Add expenses prop for deletion functionality
}

const MONTHS_BN = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const NEIGHBORHOODS = [
  'সরকার পাড়া',
  'পূর্ব পাড়া',
  'মাঠ পাড়া', 
  'উত্তর পাড়া',
  'দক্ষিণ পাড়া'
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ users, fundings, fundInfo, currentAdmin, expenses = [] }) => {
  const [activeTab, setActiveTab] = useState<'funding' | 'users' | 'info' | 'expenses'>('funding');
  
  // Funding State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(MONTHS_BN[new Date().getMonth()]);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  // User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'member'>('member');
  const [newUserNeighborhood, setNewUserNeighborhood] = useState('');
  const [userDetails, setUserDetails] = useState('');
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'member'>('member');
  const [editUserNeighborhood, setEditUserNeighborhood] = useState('');

  // Expense Filter State
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'last7days'>('last7days');
  const [currentExpensePage, setCurrentExpensePage] = useState(1);
  const expensesPerPage = 10;

  // Member Search State
  const [memberSearch, setMemberSearch] = useState('');

  // Pending Admins State
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Fund Info State
  const [fundName, setFundName] = useState(fundInfo?.name || '');
  const [fundDesc, setFundDesc] = useState(fundInfo?.description || '');

  // Listen to pending admins
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pending_admins'), (snapshot) => {
      const pending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingAdmin));
      setPendingAdmins(pending);
      setLoadingPending(false);
    });

    return () => unsubscribe();
  }, []);

  const logAction = async (type: string, details: string) => {
    await addDoc(collection(db, 'logs'), {
      type,
      details,
      timestamp: new Date().toISOString(),
      adminId: currentAdmin.uid,
      adminName: currentAdmin.displayName || 'অ্যাডমিন'
    });
  };

  const handleUpdateFunding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !amount || !month || !year) return;

    setLoading(true);
    try {
      const user = users.find(u => u.id === selectedUserId);
      const parsedAmount = parseNumericInput(amount);
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('সঠিক পরিমাণ লিখুন!');
        setLoading(false);
        return;
      }
      
      const q = query(
        collection(db, 'fundings'),
        where('userId', '==', selectedUserId),
        where('month', '==', month),
        where('year', '==', parseInt(year))
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'fundings', existingDoc.id), {
          amount: parsedAmount,
          updatedAt: new Date().toISOString(),
          updatedBy: currentAdmin.displayName || 'অ্যাডমিন'
        });
        await logAction('funding_update', `${user?.name}-এর ${month} ${year}-এর তহবিল আপডেট করা হয়েছে: ${parsedAmount} টাকা`);
      } else {
        await addDoc(collection(db, 'fundings'), {
          userId: selectedUserId,
          userName: user?.name || 'অজানা',
          amount: parsedAmount,
          month,
          year: parseInt(year),
          updatedAt: new Date().toISOString(),
          updatedBy: currentAdmin.displayName || 'অ্যাডমিন'
        });
        await logAction('funding_update', `${user?.name}-এর ${month} ${year}-এর নতুন তহবিল যোগ করা হয়েছে: ${parsedAmount} টাকা`);
      }
      setAmount('');
      alert('তহবিল সফলভাবে আপডেট হয়েছে!');
    } catch (err) {
      console.error(err);
      alert('কিছু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserPhone) return;

    setLoading(true);
    try {
      // Create user with phone number instead of email
      await addDoc(collection(db, 'users'), {
        name: newUserName,
        phone: newUserPhone,
        role: newUserRole,
        neighborhood: newUserNeighborhood || null,
        details: userDetails,
        uid: '' // Will need to be updated when user logs in
      });
      await logAction('user_add', `নতুন সদস্য যোগ করা হয়েছে: ${newUserName} (${newUserRole}) - পাড়া: ${newUserNeighborhood || 'নির্বাচিত নয়'}`);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserNeighborhood('');
      setUserDetails('');
      alert('সদস্য সফলভাবে যোগ করা হয়েছে! ব্যবহারকারী প্রথমবার লগইন করার পর UID আপডেট করতে হবে।');
    } catch (err) {
      console.error(err);
      alert('সদস্য যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFundInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (fundInfo?.id) {
        await updateDoc(doc(db, 'fund_info', fundInfo.id), {
          name: fundName,
          description: fundDesc
        });
      } else {
        await addDoc(collection(db, 'fund_info'), {
          name: fundName,
          description: fundDesc,
          year: new Date().getFullYear()
        });
      }
      alert('তহবিলের তথ্য আপডেট হয়েছে!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Function to promote a user to admin
  const handlePromoteToAdmin = async (userId: string, userName: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${userName}-কে অ্যাডমিন বানাতে চান?`)) {
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'admin'
      });
      await logAction('user_promote', `${userName}-কে অ্যাডমিন পদে উন্নীত করা হয়েছে`);
      alert(`${userName} এখন অ্যাডমিন!`);
    } catch (err) {
      console.error(err);
      alert('অ্যাডমিন বানাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to demote an admin to member
  const handleDemoteToMember = async (userId: string, userName: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${userName}-কে সদস্য পদে ফিরিয়ে আনতে চান?`)) {
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'member'
      });
      await logAction('user_demote', `${userName}-কে সদস্য পদে ফিরিয়ে আনা হয়েছে`);
      alert(`${userName} এখন সদস্য!`);
    } catch (err) {
      console.error(err);
      alert('সদস্য পদে ফিরিয়ে আনতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a user
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${userName}-কে সম্পূর্ণভাবে মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      await logAction('user_delete', `${userName}-কে সিস্টেম থেকে মুছে ফেলা হয়েছে`);
      alert(`${userName} সফলভাবে মুছে ফেলা হয়েছে!`);
    } catch (err) {
      console.error(err);
      alert('সদস্য মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete funding for a specific month
  const handleDeleteFunding = async (userId: string, userName: string, month: string, year: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${userName}-এর ${month} ${year}-এর তহবিল মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।`)) {
      return;
    }

    setLoading(true);
    try {
      // Find the funding document
      const q = query(
        collection(db, 'fundings'),
        where('userId', '==', userId),
        where('month', '==', month),
        where('year', '==', parseInt(year))
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const fundingDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, 'fundings', fundingDoc.id));
        await logAction('funding_delete', `${userName}-এর ${month} ${year}-এর তহবিল মুছে ফেলা হয়েছে`);
        alert(`${userName}-এর ${month} ${year}-এর তহবিল সফলভাবে মুছে ফেলা হয়েছে!`);
      } else {
        alert('এই মাসের জন্য কোনো তহবিল পাওয়া যায়নি।');
      }
    } catch (err) {
      console.error(err);
      alert('তহবিল মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to start editing a user
  const startEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserName(user.name);
    setEditUserPhone(user.phone || '');
    setEditUserRole(user.role || 'member');
    setEditUserNeighborhood(user.neighborhood || '');
    
    // Auto-scroll to the edit form at the top of the page
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, 100); // Small delay to ensure the edit form is rendered
  };

  // Function to cancel editing
  const cancelEditUser = () => {
    setEditingUser(null);
    setEditUserName('');
    setEditUserPhone('');
    setEditUserRole('member');
    setEditUserNeighborhood('');
  };

  // Function to update user information
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editUserName || !editUserPhone) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', editingUser.id), {
        name: editUserName,
        phone: editUserPhone,
        role: editUserRole,
        neighborhood: editUserNeighborhood || null
      });
      await logAction('user_update', `${editingUser.name}-এর তথ্য আপডেট করা হয়েছে: নতুন নাম ${editUserName}, নতুন ফোন ${editUserPhone}, নতুন রোল ${editUserRole}, নতুন পাড়া ${editUserNeighborhood || 'নির্বাচিত নয়'}`);
      alert('সদস্যের তথ্য সফলভাবে আপডেট হয়েছে!');
      cancelEditUser();
    } catch (err) {
      console.error(err);
      alert('সদস্য আপডেট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete an expense
  const handleDeleteExpense = async (expenseId: string, expenseTitle: string, expenseAmount: number) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${expenseTitle}" (${expenseAmount.toLocaleString('bn-BD')} ৳) খরচটি মুছে ফেলতে চান? এই কাজটি ফিরিয়ে আনা যাবে না।`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      await logAction('expense_delete', `"${expenseTitle}" (${expenseAmount.toLocaleString('bn-BD')} ৳) খরচটি মুছে ফেলা হয়েছে`);
      alert(`"${expenseTitle}" খরচটি সফলভাবে মুছে ফেলা হয়েছে!`);
    } catch (err) {
      console.error(err);
      alert('খরচ মুছতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to approve a pending admin request
  const handleApproveAdmin = async (pendingId: string, uid: string, name: string, email: string, phone?: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${name} (${email}) কে অ্যাডমিন হিসেবে অনুমোদন করতে চান?`)) {
      return;
    }

    setLoading(true);
    try {
      // Create user document in users collection
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        name: name,
        email: email,
        phone: phone || '',
        role: 'admin',
        details: 'অ্যাডমিন অনুমোদনের মাধ্যমে যোগ করা হয়েছে',
        createdAt: new Date().toISOString()
      });

      // Update pending admin status to approved
      await updateDoc(doc(db, 'pending_admins', pendingId), {
        status: 'approved',
        reviewedBy: currentAdmin.displayName || 'অ্যাডমিন',
        reviewedAt: new Date().toISOString(),
        notes: 'অ্যাডমিন হিসেবে অনুমোদিত'
      });

      await logAction('admin_approve', `${name} (${email}) কে অ্যাডমিন হিসেবে অনুমোদন করা হয়েছে`);
      alert(`${name} কে অ্যাডমিন হিসেবে অনুমোদন করা হয়েছে!`);
    } catch (err) {
      console.error(err);
      alert('অ্যাডমিন অনুমোদন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // Function to reject a pending admin request
  const handleRejectAdmin = async (pendingId: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে ${name}-এর অ্যাডমিন অনুরোধ প্রত্যাখ্যান করতে চান?`)) {
      return;
    }

    setLoading(true);
    try {
      // Update pending admin status to rejected
      await updateDoc(doc(db, 'pending_admins', pendingId), {
        status: 'rejected',
        reviewedBy: currentAdmin.displayName || 'অ্যাডমিন',
        reviewedAt: new Date().toISOString(),
        notes: 'অ্যাডমিন অনুরোধ প্রত্যাখ্যান করা হয়েছে'
      });

      await logAction('admin_reject', `${name}-এর অ্যাডমিন অনুরোধ প্রত্যাখ্যান করা হয়েছে`);
      alert(`${name}-এর অ্যাডমিন অনুরোধ প্রত্যাখ্যান করা হয়েছে!`);
    } catch (err) {
      console.error(err);
      alert('অ্যাডমিন অনুরোধ প্রত্যাখ্যান করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('funding')}
          className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'funding' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <DollarSign size={16} />
          তহবিল
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'users' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={16} />
          সদস্য
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'info' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Settings size={16} />
          সেটিংস
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'expenses' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Receipt size={16} />
          খরচ
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'expenses' && (
          <motion.div
            key="expenses"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Add Expense Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                  <Receipt size={18} />
                </div>
                <h3 className="text-lg font-black text-slate-800">নতুন খরচ যোগ করুন</h3>
              </div>
              <ExpenseForm 
                onSuccess={() => {
                  alert('খরচ সফলভাবে যোগ করা হয়েছে!');
                }}
              />
            </div>

            {/* Expense List with Delete Buttons */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                    <Trash2 size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">বর্তমান খরচ তালিকা</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {expenses.length.toLocaleString('bn-BD')} টি খরচ
                </span>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                ভুল করে প্রবেশ করা খরচ মুছে ফেলতে নিচের তালিকা ব্যবহার করুন। সতর্কতা: মুছে ফেলা খরচ ফিরিয়ে আনা যাবে না।
              </p>

              {/* Filter Controls */}
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">ফিল্টার:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setExpenseFilter('last7days');
                        setCurrentExpensePage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        expenseFilter === 'last7days'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      শেষ ৭ দিন
                    </button>
                    <button
                      onClick={() => {
                        setExpenseFilter('all');
                        setCurrentExpensePage(1);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        expenseFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      সকল খরচ
                    </button>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  পৃষ্ঠা {currentExpensePage}
                </span>
              </div>

              {/* Filtered Expenses */}
              {(() => {
                // Filter expenses based on selected filter
                const filteredExpenses = expenses.filter(expense => {
                  if (expenseFilter === 'last7days') {
                    const expenseDate = new Date(expense.date);
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return expenseDate >= sevenDaysAgo;
                  }
                  return true; // 'all' filter
                });

                // Calculate pagination
                const totalPages = Math.ceil(filteredExpenses.length / expensesPerPage);
                const startIndex = (currentExpensePage - 1) * expensesPerPage;
                const endIndex = startIndex + expensesPerPage;
                const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

                return (
                  <>
                    {filteredExpenses.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        <p className="text-sm">
                          {expenseFilter === 'last7days' 
                            ? 'শেষ ৭ দিনে কোনো খরচ পাওয়া যায়নি' 
                            : 'কোনো খরচ পাওয়া যায়নি'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {paginatedExpenses.map(expense => (
                            <div key={expense.id} className="p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-slate-900">{expense.title}</h4>
                                  <p className="text-xs text-slate-500 mt-1">{expense.description}</p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                      {expense.date}
                                    </span>
                                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                      {expense.category}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-black text-red-600">
                                    {expense.amount.toLocaleString('bn-BD')} ৳
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-1">
                                    ID: {expense.id.substring(0, 8)}...
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                <button
                                  onClick={() => handleDeleteExpense(expense.id, expense.title, expense.amount)}
                                  disabled={loading}
                                  className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  <Trash2 size={12} />
                                  খরচ মুছুন
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="mt-6 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => setCurrentExpensePage(prev => Math.max(1, prev - 1))}
                                disabled={currentExpensePage === 1}
                                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
                              >
                                পূর্ববর্তী
                              </button>
                              <span className="text-xs text-slate-600">
                                পৃষ্ঠা {currentExpensePage} / {totalPages}
                              </span>
                              <button
                                onClick={() => setCurrentExpensePage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentExpensePage === totalPages}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                              >
                                পরবর্তী
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 text-center mt-2">
                              দেখানো হচ্ছে {startIndex + 1}-{Math.min(endIndex, filteredExpenses.length)} নং খরচ (মোট {filteredExpenses.length} টি)
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
        {activeTab === 'funding' && (
          <motion.div
            key="funding"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Update Funding Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <form onSubmit={handleUpdateFunding} className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">তহবিল আপডেট করুন</h3>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">সদস্য নির্বাচন করুন</label>
                  
                  {/* Member Search Input */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="সদস্যের নাম বা পাড়া খুঁজুন..."
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {users.length} জন
                    </span>
                  </div>
                  
                  {/* Filtered Member Dropdown */}
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">সদস্য বেছে নিন</option>
                    {users
                      .filter(u => 
                        !memberSearch || 
                        u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        (u.neighborhood && u.neighborhood.toLowerCase().includes(memberSearch.toLowerCase()))
                      )
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.neighborhood ? `(${u.neighborhood})` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    নামের সাথে পাড়া দেখানো হচ্ছে। সার্চ বক্সে নাম বা পাড়া লিখুন।
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">মাস</label>
                    <select
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    >
                      {MONTHS_BN.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">বছর</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">পরিমাণ (টাকা)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">৳</span>
                    <input
                      type="text"
                      placeholder="৫০০ বা 500"
                      className="w-full pl-8 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm"
                      value={amount}
                      onChange={(e) => {
                        const normalized = normalizeNumericInput(e.target.value);
                        setAmount(normalized);
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // Simple calculator prompt for AdminPanel
                        const input = prompt('পরিমাণ লিখুন (বাংলা বা ইংরেজি সংখ্যা):', amount);
                        if (input !== null) {
                          const normalized = normalizeNumericInput(input);
                          setAmount(normalized);
                        }
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
                      title="ক্যালকুলেটর"
                    >
                      <Calculator size={18} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">বাংলা (০-৯) বা ইংরেজি (0-9) সংখ্যা ব্যবহার করুন</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'আপডেট হচ্ছে...' : 'তহবিল আপডেট করুন'}
                </button>
              </form>
            </div>

            {/* Delete Funding Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                  <Trash2 size={18} />
                </div>
                <h3 className="text-lg font-black text-slate-800">তহবিল মুছুন</h3>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                ভুল করে প্রবেশ করা তহবিল মুছে ফেলতে এই ফর্ম ব্যবহার করুন। সতর্কতা: মুছে ফেলা তহবিল ফিরিয়ে আনা যাবে না।
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">সদস্য নির্বাচন করুন</label>
                  
                  {/* Member Search Input */}
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="সদস্যের নাম বা পাড়া খুঁজুন..."
                      className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {users.length} জন
                    </span>
                  </div>
                  
                  {/* Filtered Member Dropdown */}
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">সদস্য বেছে নিন</option>
                    {users
                      .filter(u => 
                        !memberSearch || 
                        u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                        (u.neighborhood && u.neighborhood.toLowerCase().includes(memberSearch.toLowerCase()))
                      )
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.neighborhood ? `(${u.neighborhood})` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    নামের সাথে পাড়া দেখানো হচ্ছে। সার্চ বক্সে নাম বা পাড়া লিখুন।
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">মাস</label>
                    <select
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    >
                      {MONTHS_BN.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">বছর</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    const user = users.find(u => u.id === selectedUserId);
                    if (user && month && year) {
                      handleDeleteFunding(selectedUserId, user.name, month, year);
                    } else {
                      alert('দয়া করে সদস্য, মাস এবং বছর নির্বাচন করুন।');
                    }
                  }}
                  disabled={loading || !selectedUserId || !month || !year}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'মুছে ফেলা হচ্ছে...' : 'তহবিল মুছুন'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Edit User Form */}
            {editingUser && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-blue-300">
                <form onSubmit={handleUpdateUser} className="space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                        <Save size={18} />
                      </div>
                      <h3 className="text-lg font-black text-slate-800">সদস্য তথ্য আপডেট করুন</h3>
                    </div>
                    <button
                      type="button"
                      onClick={cancelEditUser}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">নাম (বাংলায়)</label>
                    <input
                      type="text"
                      placeholder="উদা: আব্দুল করিম"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">ফোন নম্বর</label>
                    <input
                      type="tel"
                      placeholder="০১৭১২৩৪৫৬৭৮"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={editUserPhone}
                      onChange={(e) => setEditUserPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">রোল</label>
                    <select
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={editUserRole}
                      onChange={(e) => setEditUserRole(e.target.value as 'admin' | 'member')}
                    >
                      <option value="member">সদস্য</option>
                      <option value="admin">অ্যাডমিন</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">পাড়া (নির্বাচন করুন)</label>
                    <select
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                      value={editUserNeighborhood}
                      onChange={(e) => setEditUserNeighborhood(e.target.value)}
                    >
                      <option value="">পাড়া নির্বাচন করুন</option>
                      {NEIGHBORHOODS.map(neighborhood => (
                        <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">একই নামের সদস্যদের আলাদা করতে পাড়া নির্বাচন করুন</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={cancelEditUser}
                      className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-2xl font-black text-sm hover:bg-slate-300 transition-all active:scale-[0.98]"
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? 'আপডেট হচ্ছে...' : 'আপডেট করুন'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Add User Form */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <form onSubmit={handleAddUser} className="space-y-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">নতুন সদস্য যোগ করুন</h3>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">নাম (বাংলায়)</label>
                  <input
                    type="text"
                    placeholder="উদা: আব্দুল করিম"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">ফোন নম্বর</label>
                  <input
                    type="tel"
                    placeholder="০১৭১২৩৪৫৬৭৮"
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">রোল</label>
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'member')}
                  >
                    <option value="member">সদস্য</option>
                    <option value="admin">অ্যাডমিন</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">পাড়া (নির্বাচন করুন)</label>
                  <select
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm"
                    value={newUserNeighborhood}
                    onChange={(e) => setNewUserNeighborhood(e.target.value)}
                  >
                    <option value="">পাড়া নির্বাচন করুন</option>
                    {NEIGHBORHOODS.map(neighborhood => (
                      <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">একই নামের সদস্যদের আলাদা করতে পাড়া নির্বাচন করুন</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-slate-200 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'যোগ হচ্ছে...' : 'সদস্য যোগ করুন'}
                </button>
              </form>
            </div>

            {/* Pending Admin Approvals Section */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-lg flex items-center justify-center">
                    <UserPlus size={18} />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">অ্যাডমিন অনুরোধ</h3>
                </div>
                <span className="text-[10px] font-bold text-yellow-600 uppercase">
                  {pendingAdmins.filter(p => p.status === 'pending').length} টি অনুরোধ
                </span>
              </div>
              
              <p className="text-sm text-slate-600 mb-4">
                নতুন ব্যবহারকারীরা অ্যাডমিন এক্সেসের জন্য অনুরোধ করেছেন। তাদের অনুমোদন বা প্রত্যাখ্যান করুন।
              </p>
              
              {loadingPending ? (
                <div className="py-4 text-center text-slate-400">
                  <p className="text-sm">লোড হচ্ছে...</p>
                </div>
              ) : pendingAdmins.filter(p => p.status === 'pending').length === 0 ? (
                <div className="py-4 text-center text-slate-400">
                  <p className="text-sm">কোনো নতুন অ্যাডমিন অনুরোধ নেই</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingAdmins
                    .filter(p => p.status === 'pending')
                    .map(pending => (
                      <div key={pending.id} className="bg-white p-4 rounded-xl border border-yellow-100">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-bold text-slate-900">{pending.name}</p>
                            <p className="text-xs text-slate-500 mt-1">{pending.email}</p>
                            {pending.phone && (
                              <p className="text-xs text-slate-500">ফোন: {pending.phone}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-2">
                              অনুরোধের তারিখ: {new Date(pending.requestedAt).toLocaleDateString('bn-BD')}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-bold px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg">
                              অপেক্ষমান
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => handleApproveAdmin(pending.id, pending.uid, pending.name, pending.email, pending.phone)}
                            disabled={loading}
                            className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            অনুমোদন করুন
                          </button>
                          <button
                            onClick={() => handleRejectAdmin(pending.id, pending.name)}
                            disabled={loading}
                            className="flex-1 bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            প্রত্যাখ্যান করুন
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-slate-800">বর্তমান সদস্য তালিকা</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{users.length.toLocaleString('bn-BD')} জন</span>
              </div>
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center font-bold">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 leading-tight">{u.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">{u.phone || u.email}</p>
                          {u.neighborhood && (
                            <p className="text-[9px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">
                              {u.neighborhood}
                            </p>
                          )}
                          {u.uid && (
                            <p className="text-[8px] text-slate-300 font-mono mt-1">UID: {u.uid.substring(0, 8)}...</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[9px] uppercase font-black px-2 py-1 rounded-lg ${
                        u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {u.role === 'admin' ? 'অ্যাডমিন' : 'সদস্য'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50">
                      <button
                        onClick={() => startEditUser(u)}
                        disabled={loading}
                        className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Save size={12} />
                        এডিট
                      </button>
                      {u.role === 'member' ? (
                        <button
                          onClick={() => handlePromoteToAdmin(u.id, u.name)}
                          disabled={loading}
                          className="flex-1 bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          অ্যাডমিন
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDemoteToMember(u.id, u.name)}
                          disabled={loading}
                          className="flex-1 bg-slate-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          সদস্য
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        disabled={loading}
                        className="flex-1 bg-red-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} />
                        মুছুন
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
          >
            <form onSubmit={handleUpdateFundInfo} className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
                  <Settings size={18} />
                </div>
                <h3 className="text-lg font-black text-slate-800">তহবিলের সাধারণ তথ্য</h3>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">তহবিলের নাম</label>
                <input
                  type="text"
                  placeholder="উদা: গরুর মাংস তহবিল ২০২৬"
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-bold text-sm"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">বিস্তারিত বর্ণনা</label>
                <textarea
                  className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 font-bold text-sm"
                  rows={4}
                  value={fundDesc}
                  onChange={(e) => setFundDesc(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-purple-100 hover:bg-purple-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'সংরক্ষণ হচ্ছে...' : 'তথ্য সংরক্ষণ করুন'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
