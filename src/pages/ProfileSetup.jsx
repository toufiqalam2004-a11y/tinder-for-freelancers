import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ChevronLeft, Plus, Trash2, CheckCircle2, ShieldCheck, Sparkles, ExternalLink, Camera, Mail, AtSign, Check, X, Loader2 } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import ProfilePhotoModal from '../components/ProfilePhotoModal.jsx';
import { useProfile } from '../contexts/ProfileContext';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, EXPERIENCE_LEVELS, SKILL_LEVELS, JOB_TYPES, REMOTE_OPTIONS } from '../utils/constants';
import { calculateProfileStrength } from '../services/proMatchEngine';
import { aiService } from '../services/aiService';
import { getUserPhoto, saveUserPhoto, removeUserPhoto } from '../data/storage.js';
import { isValidEmail, isValidUsername, normalizeUsername } from '../utils/validators.js';
import { getApiUrl } from '../config/apiConfig.js';
import toast from 'react-hot-toast';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { profile, saveProfile, isProfileComplete } = useProfile();
  const authContext = useAuth();
  const profilePhoto = authContext?.profilePhoto;
  const setProfilePhoto = authContext?.setProfilePhoto;
  
  const userId = profile?.id || 'default_user';
  const [name, setName] = useState(profile?.name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [usernameStatus, setUsernameStatus] = useState(profile?.username ? 'available' : 'idle');
  const [usernameMessage, setUsernameMessage] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(() => profilePhoto || getUserPhoto(userId) || '');
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [profession, setProfession] = useState(profile?.profession || '');
  const [primaryRole, setPrimaryRole] = useState(profile?.primaryRole || profile?.profession || '');
  const [secondaryRoleInput, setSecondaryRoleInput] = useState('');
  const [secondaryRoles, setSecondaryRoles] = useState(profile?.secondaryRoles || []);
  const [category, setCategory] = useState(profile?.category || 'Creative');
  const [specialization, setSpecialization] = useState(profile?.specialization || '');
  const [experience, setExperience] = useState(profile?.experience || 'Mid-Level (3-5 years)');
  const [yearsOfExperience, setYearsOfExperience] = useState(profile?.yearsOfExperience !== undefined ? profile.yearsOfExperience : 3);
  const [bio, setBio] = useState(profile?.bio || '');

  // Structured skills: [{ name, level, category }]
  const initialSkills = (profile?.skills || []).map((s) =>
    typeof s === 'string' ? { name: s, level: 'Advanced', category: 'Creative' } : s
  );
  const [skills, setSkills] = useState(initialSkills);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('Advanced');

  // Multiple portfolio links
  const initialPortfolios = (profile?.portfolioLinks && profile.portfolioLinks.length > 0)
    ? profile.portfolioLinks
    : profile?.portfolioUrl
    ? [{ id: 'port-1', title: 'Main Portfolio', url: profile.portfolioUrl, isPrimary: true }]
    : [{ id: 'port-1', title: 'Main Portfolio', url: '', isPrimary: true }];
  const [portfolioLinks, setPortfolioLinks] = useState(initialPortfolios);

  // Career & Work Preferences
  const [preferredJobTypes, setPreferredJobTypes] = useState(profile?.preferredJobTypes || ['freelance', 'contract']);
  const [remotePreference, setRemotePreference] = useState(profile?.remotePreference || 'remote');
  const [expectedSalaryMin, setExpectedSalaryMin] = useState(profile?.expectedSalaryMin || 500);
  const [expectedSalaryMax, setExpectedSalaryMax] = useState(profile?.expectedSalaryMax || 3000);
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [availability, setAvailability] = useState(profile?.availability || 'Immediately');

  // CV Upload
  const [cvFileName, setCvFileName] = useState(profile?.cvUrl ? 'demo-cv.pdf' : '');
  const [errors, setErrors] = useState({});

  // Dynamic Profile Strength
  const previewProfile = {
    name,
    profession: primaryRole || profession,
    primaryRole: primaryRole || profession,
    specialization,
    skills,
    portfolioUrl: portfolioLinks[0]?.url || '',
    portfolioLinks,
    cvUrl: cvFileName ? 'uploaded' : '',
    bio,
    preferredJobTypes,
  };
  const strength = calculateProfileStrength(previewProfile);

  // Add / Remove Secondary Roles
  const handleAddSecondaryRole = (e) => {
    e.preventDefault();
    if (secondaryRoleInput.trim() && !secondaryRoles.includes(secondaryRoleInput.trim())) {
      setSecondaryRoles([...secondaryRoles, secondaryRoleInput.trim()]);
      setSecondaryRoleInput('');
    }
  };

  const handleRemoveSecondaryRole = (role) => {
    setSecondaryRoles(secondaryRoles.filter((r) => r !== role));
  };

  // Add / Remove Skills with Level
  const handleAddSkill = (e) => {
    e.preventDefault();
    if (newSkillName.trim() && !skills.some((s) => s.name.toLowerCase() === newSkillName.trim().toLowerCase())) {
      setSkills([...skills, { name: newSkillName.trim(), level: newSkillLevel, category }]);
      setNewSkillName('');
    }
  };

  const handleRemoveSkill = (skillName) => {
    setSkills(skills.filter((s) => s.name !== skillName));
  };

  const handleUpdateSkillLevel = (index, level) => {
    const updated = [...skills];
    updated[index].level = level;
    setSkills(updated);
  };

  // Portfolio Links handlers
  const handleAddPortfolio = () => {
    setPortfolioLinks([
      ...portfolioLinks,
      { id: `port-${Date.now()}`, title: 'Portfolio Project', url: '', isPrimary: false },
    ]);
  };

  const handleUpdatePortfolio = (index, field, val) => {
    const updated = [...portfolioLinks];
    updated[index][field] = val;
    setPortfolioLinks(updated);
  };

  const handleRemovePortfolio = (index) => {
    setPortfolioLinks(portfolioLinks.filter((_, i) => i !== index));
  };

  const toggleJobTypePreference = (type) => {
    if (preferredJobTypes.includes(type)) {
      if (preferredJobTypes.length > 1) {
        setPreferredJobTypes(preferredJobTypes.filter((t) => t !== type));
      }
    } else {
      setPreferredJobTypes([...preferredJobTypes, type]);
    }
  };

  const fileInputRef = React.useRef(null);

  const handleCvFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Security validation: allowed extensions and MIME types
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const validMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExt) && !validMimeTypes.includes(file.type)) {
      toast.error('Invalid file format. Please upload a PDF or DOC/DOCX document.');
      e.target.value = '';
      return;
    }

    // Size limit: 10MB
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      toast.error('File size exceeds the 10MB limit.');
      e.target.value = '';
      return;
    }

    // Sanitize file name: remove path separators and control characters
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);

    setCvFileName(sanitizedName);
    const parsed = aiService.extractCvSkills(sanitizedName);
    const existingNames = new Set(skills.map((s) => s.name.toLowerCase()));
    const toAdd = parsed.filter((p) => !existingNames.has(p.name.toLowerCase()));
    if (toAdd.length > 0) {
      setSkills([...skills, ...toAdd]);
      toast.success(`CV uploaded: ${file.name}. Extracted ${toAdd.length} skills.`, { icon: '📄' });
    } else {
      toast.success(`CV uploaded: ${file.name}.`, { icon: '📄' });
    }
  };

  const handleCvUploadSim = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setCvFileName('Resume_2026.pdf');
      const parsed = aiService.extractCvSkills('Resume_2026.pdf');
      const existingNames = new Set(skills.map((s) => s.name.toLowerCase()));
      const toAdd = parsed.filter((p) => !existingNames.has(p.name.toLowerCase()));
      if (toAdd.length > 0) {
        setSkills([...skills, ...toAdd]);
        toast.success(`CV uploaded! Auto-extracted ${toAdd.length} skills.`, { icon: '📄' });
      } else {
        toast.success('CV attached successfully!', { icon: '📄' });
      }
    }
  };

  const validateUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /^https?:\/\/.+\..+/i.test(url.trim());
  };

  const checkUsernameAvailability = async (uname) => {
    if (!uname || !uname.trim()) {
      setUsernameStatus('idle');
      setUsernameMessage('');
      setUsernameSuggestions([]);
      return;
    }

    const clean = uname.trim();
    if (!isValidUsername(clean)) {
      setUsernameStatus('invalid');
      setUsernameMessage('Enter a valid username (3-30 characters, letters, numbers, _, -, .)');
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus('checking');
    setUsernameMessage('Checking availability...');

    try {
      const authHeader = {};
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawAuth = window.localStorage.getItem('tf_auth');
        if (rawAuth) {
          const auth = JSON.parse(rawAuth);
          if (auth.token) authHeader['Authorization'] = `Bearer ${auth.token}`;
          if (auth.userId) authHeader['x-user-id'] = auth.userId;
        }
      }
      if (userId && userId !== 'default_user') {
        authHeader['x-user-id'] = userId;
      }

      const checkUrl = getApiUrl(`/profile/check-username?username=${encodeURIComponent(clean)}`);
      const res = await fetch(checkUrl, {
        headers: authHeader,
      });
      const data = await res.json();

      if (data.available) {
        setUsernameStatus('available');
        setUsernameMessage('✓ Username available');
        setUsernameSuggestions([]);
      } else {
        setUsernameStatus('taken');
        setUsernameMessage('✕ Username already taken. Please try a different username.');
        setUsernameSuggestions(data.suggestions || []);
      }
    } catch {
      setUsernameStatus('idle');
      setUsernameMessage('');
    }
  };

  useEffect(() => {
    if (!username || username.trim() === (profile?.username || '').trim()) {
      if (username && username.trim() === (profile?.username || '').trim()) {
        setUsernameStatus('available');
        setUsernameMessage('✓ Username available');
      } else {
        setUsernameStatus('idle');
        setUsernameMessage('');
      }
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 350);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  const handleSelectSuggestion = (sug) => {
    setUsername(sug);
    checkUsernameAvailability(sug);
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Full name is required';

    // Username validation
    if (username.trim()) {
      if (!isValidUsername(username.trim())) {
        newErrors.username = 'Enter a valid username (3-30 characters, letters, numbers, _, -, .)';
      } else if (usernameStatus === 'taken') {
        newErrors.username = 'Username already taken. Please try a different username.';
      }
    }

    // Email validation (Mandatory)
    if (!email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!isValidEmail(email.trim())) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (!profession.trim() && !primaryRole.trim()) newErrors.profession = 'Primary target role is required';
    if (!category.trim()) newErrors.category = 'Job category is required';
    if (!specialization.trim()) newErrors.specialization = 'Specialization / niche is required';
    if (!skills || skills.length === 0) newErrors.skills = 'Add at least one skill.';

    const primaryPort = portfolioLinks.find((p) => p.isPrimary)?.url || portfolioLinks[0]?.url || '';
    if (!primaryPort.trim()) {
      newErrors.portfolio = 'Portfolio link is required';
    } else if (!validateUrl(primaryPort)) {
      newErrors.portfolio = 'Please enter a valid portfolio URL (e.g. https://...)';
    }

    if (!bio || !bio.trim()) {
      newErrors.bio = 'Bio is required';
    }

    if (!cvFileName) {
      newErrors.cv = 'Please upload your CV to complete your profile';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.email) {
        toast.error(newErrors.email);
      } else if (newErrors.username) {
        toast.error(newErrors.username);
      } else {
        toast.error('Please complete all required fields.');
      }
      return;
    }

    setErrors({});

    try {
      await saveProfile({
        name: name.trim(),
        username: username.trim() ? username.trim().toLowerCase() : undefined,
        email: email.trim(),
        profession: (primaryRole || profession).trim(),
        primaryRole: (primaryRole || profession).trim(),
        secondaryRoles,
        category: category || 'Creative',
        specialization: (specialization || primaryRole || profession).trim(),
        experience,
        yearsOfExperience: Number(yearsOfExperience),
        bio: bio.trim(),
        skills,
        portfolioUrl: primaryPort.trim(),
        portfolioLinks: portfolioLinks.filter((p) => p.url && p.url.trim().length > 0),
        cvUrl: cvFileName ? 'uploaded' : null,
        cvFileName: cvFileName || null,
        preferredJobTypes,
        remotePreference,
        expectedSalaryMin: Number(expectedSalaryMin),
        expectedSalaryMax: Number(expectedSalaryMax),
        currency,
        availability,
      });

      toast.success('Pro Profile saved successfully!');
      navigate('/jobs');
    } catch (err) {
      if (err.status === 409 || err.code === 'USERNAME_TAKEN') {
        setUsernameStatus('taken');
        if (err.suggestions && err.suggestions.length > 0) {
          setUsernameSuggestions(err.suggestions);
        }
        setErrors((prev) => ({
          ...prev,
          username: err.message || 'Username already taken. Please try a different username.',
        }));
        toast.error(err.message || 'Username already taken. Please try a different username.');
      } else {
        toast.error(err.message || 'Failed to save profile. Please try again.');
      }
    }
  };

  return (
    <PageTransition>
      <div className="px-5 py-6 pb-32 max-w-md mx-auto min-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          {isProfileComplete && (
            <button
              onClick={() => navigate(-1)}
              className="text-text-secondary hover:text-text-primary p-1 -ml-1 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isProfileComplete ? 'Edit Pro Profile' : 'Setup Pro Profile'}
            </h1>
            <p className="text-xs text-text-muted">Powers your intelligent matching algorithm</p>
          </div>
        </div>

        {/* Profile Photo Section */}
        <div className="flex flex-col items-center mb-5">
          <div className="relative">
            <div
              onClick={() => setShowPhotoModal(true)}
              className="w-20 h-20 rounded-full overflow-hidden border-2 border-primary/30 shadow-md flex items-center justify-center cursor-pointer group bg-surface"
              title="Click to change profile photo"
            >
              {avatarUrl && !imgError ? (
                <img
                  src={avatarUrl}
                  alt={name || 'Profile'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="gradient-primary w-full h-full flex items-center justify-center text-white text-2xl font-extrabold">
                  {name ? name.charAt(0).toUpperCase() : 'TF'}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-primary text-white hover:bg-primary-dark shadow-md border-2 border-surface transition-transform hover:scale-110"
              title="Change profile photo"
              aria-label="Change profile photo"
            >
              <Camera size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPhotoModal(true)}
            className="text-xs text-primary font-semibold mt-2 hover:underline"
          >
            {avatarUrl ? 'Change Photo' : 'Add Profile Photo'}
          </button>
        </div>

        {/* Profile Strength Meter */}
        <Card className="mb-5 p-4 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                Profile Strength
              </span>
            </div>
            <span className="text-xs font-extrabold text-primary">{strength.score}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-surface-hover h-2 rounded-full overflow-hidden mt-2">
            <div
              className="h-full gradient-primary transition-all duration-500 rounded-full"
              style={{ width: `${strength.score}%` }}
            />
          </div>

          {strength.tips.length > 0 && (
            <p className="text-[11px] text-text-muted mt-2">
              💡 Tip: <span className="text-text-secondary">{strength.tips[0].label}</span> (+{strength.tips[0].pts}%)
            </p>
          )}
        </Card>

        {/* 1-Click Demo Profile Preset */}
        <div className="mb-5 bg-surface border border-border rounded-xl p-3 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-text-primary block">Demo Preset: Senior Editor</span>
            <span className="text-[11px] text-text-muted">Toufiq • 4 yrs exp • Premiere & AE</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setName('Toufiq');
              setUsername('toufiq_editor');
              setEmail('toufiq@example.com');
              setUsernameStatus('available');
              setProfession('Video Editor');
              setPrimaryRole('Lead Video Editor');
              setSecondaryRoles(['Short-Form Specialist', 'Motion Graphics Designer']);
              setCategory('Creative');
              setSpecialization('YouTube & Short-Form Video');
              setExperience('Mid-Level (3-5 years)');
              setYearsOfExperience(4);
              setBio('Senior video editor focused on high-retention storytelling, motion graphics, and organic viral growth.');
              setSkills([
                { name: 'Premiere Pro', level: 'Expert', category: 'Creative' },
                { name: 'After Effects', level: 'Advanced', category: 'Creative' },
                { name: 'Motion Graphics', level: 'Advanced', category: 'Creative' },
                { name: 'Sound Design', level: 'Intermediate', category: 'Audio' },
                { name: 'Color Grading', level: 'Intermediate', category: 'Creative' },
              ]);
              setPortfolioLinks([
                { id: 'port-1', title: 'Main Showreel', url: 'https://toufiq.in', isPrimary: true },
                { id: 'port-2', title: 'YouTube Edits', url: 'https://youtube.com/@toufiq_edits', isPrimary: false },
              ]);
              setCvFileName('Toufiq_CV_2026.pdf');
              setPreferredJobTypes(['freelance', 'contract']);
              setRemotePreference('remote');
              setExpectedSalaryMin(600);
              setExpectedSalaryMax(3500);
              setErrors({});
              toast.success('Loaded Toufiq Senior Profile Preset!');
            }}
            className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-semibold transition-colors"
          >
            Auto-Fill
          </button>
        </div>

        <div className="space-y-4">
          <Input 
            label="Full Name" 
            placeholder="Your full name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            error={errors.name}
          />

          {/* Username with Live Availability Indicator */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Username <span className="text-text-muted text-xs font-normal">(unique @handle)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-semibold select-none">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: '' }));
                }}
                onBlur={() => {
                  if (username) checkUsernameAvailability(username);
                }}
                placeholder="username"
                className={`w-full bg-surface border rounded-xl pl-8 pr-10 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 ${
                  usernameStatus === 'available'
                    ? 'border-emerald-500/50 focus:ring-emerald-500/20'
                    : usernameStatus === 'taken' || errors.username
                    ? 'border-rose-500 focus:ring-rose-500/20'
                    : 'border-border focus:ring-primary/20 focus:border-primary'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {usernameStatus === 'checking' && (
                  <Loader2 size={16} className="text-text-muted animate-spin" />
                )}
                {usernameStatus === 'available' && (
                  <Check size={16} className="text-emerald-500" />
                )}
                {usernameStatus === 'taken' && (
                  <X size={16} className="text-rose-500" />
                )}
              </div>
            </div>

            {/* Availability Feedback Message */}
            {usernameStatus === 'available' && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                ✓ Username available
              </p>
            )}
            {(usernameStatus === 'taken' || errors.username) && (
              <p className="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1">
                {errors.username || usernameMessage || '✕ Username already taken. Please try a different username.'}
              </p>
            )}

            {/* Verified Available Suggestions Chips */}
            {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-surface-hover/80 border border-border">
                <span className="text-[11px] text-text-secondary block mb-1.5 font-medium">
                  Available suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {usernameSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleSelectSuggestion(sug)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors font-medium"
                    >
                      @{sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Email for AI Agent Outreach */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              Email Address <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted select-none">
                <Mail size={16} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="your.email@example.com"
                className={`w-full bg-surface border rounded-xl pl-9 pr-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 ${
                  errors.email ? 'border-rose-500 focus:ring-rose-500/20' : 'border-border focus:ring-primary/20 focus:border-primary'
                }`}
              />
            </div>
            {errors.email ? (
              <p className="text-xs text-rose-500 mt-1">{errors.email}</p>
            ) : (
              <p className="text-[11px] text-text-muted mt-1">
                Mandatory for AI agent outreach, client replies, and proposal notifications.
              </p>
            )}
          </div>

          {/* Primary & Secondary Roles */}
          <div>
            <Input 
              label="Primary Target Role" 
              placeholder="e.g. Video Editor, Full-Stack Developer" 
              value={primaryRole} 
              onChange={(e) => {
                setPrimaryRole(e.target.value);
                setProfession(e.target.value);
              }} 
              error={errors.profession}
            />
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {['Lead Video Editor', 'Short-Form Editor', 'Motion Designer', 'Content Creator'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPrimaryRole(p);
                    setProfession(p);
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    primaryRole === p ? 'bg-primary/20 border-primary text-primary-light font-medium' : 'bg-surface border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary Roles */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Secondary / Adjacent Roles (optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={secondaryRoleInput}
                onChange={(e) => setSecondaryRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSecondaryRole(e);
                }}
                placeholder="e.g. YouTube Producer, Thumbnail Designer"
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddSecondaryRole}
                className="px-3 py-2 bg-surface-hover hover:bg-border text-text-primary rounded-xl text-xs font-semibold"
              >
                + Add
              </button>
            </div>
            {secondaryRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {secondaryRoles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-hover border border-border text-xs text-text-primary"
                  >
                    {role}
                    <button
                      type="button"
                      onClick={() => handleRemoveSecondaryRole(role)}
                      className="text-text-muted hover:text-rose-500 text-sm leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Category & Specialization */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Job Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full bg-surface border rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary ${
                  errors.category ? 'border-error' : 'border-border'
                }`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-error text-xs mt-1">{errors.category}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Years of Exp</label>
              <input
                type="number"
                min={0}
                max={40}
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <Input 
              label="Specialization / Niche" 
              placeholder="e.g. YouTube Retention, SaaS Promos" 
              value={specialization} 
              onChange={(e) => setSpecialization(e.target.value)}
              error={errors.specialization}
            />
          </div>

          {/* Work Preferences & Rate Expectations */}
          <div className="bg-surface border border-border rounded-xl p-3.5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Work & Rate Preferences
            </h4>

            {/* Preferred Job Types */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">Preferred Arrangements</label>
              <div className="flex gap-1.5 flex-wrap">
                {JOB_TYPES.map((type) => {
                  const active = preferredJobTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleJobTypePreference(type)}
                      className={`text-xs px-2.5 py-1 rounded-lg border capitalize transition-colors ${
                        active
                          ? 'bg-primary/15 border-primary text-primary font-semibold'
                          : 'bg-background border-border text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remote Preference */}
            <div>
              <label className="block text-[11px] text-text-muted mb-1.5">Remote Location</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'remote', label: 'Remote Only' },
                  { id: 'hybrid', label: 'Hybrid' },
                  { id: 'onsite', label: 'On-site' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRemotePreference(opt.id)}
                    className={`text-xs py-1.5 px-2 rounded-lg border text-center transition-colors ${
                      remotePreference === opt.id
                        ? 'bg-primary/15 border-primary text-primary font-semibold'
                        : 'bg-background border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expected Salary Minimum */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Min Target Rate ($)</label>
                <input
                  type="number"
                  min={0}
                  value={expectedSalaryMin}
                  onChange={(e) => setExpectedSalaryMin(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                  placeholder="e.g. 500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-text-muted mb-1">Availability</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="Immediately">Immediately</option>
                  <option value="Within 2 weeks">Within 2 weeks</option>
                  <option value="Part-time only">Part-time only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Structured Skill Profiler */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Skills Profiler (with proficiency levels)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Premiere Pro"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSkill(e);
                }}
                className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <select
                value={newSkillLevel}
                onChange={(e) => setNewSkillLevel(e.target.value)}
                className="bg-surface border border-border rounded-xl px-2 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                {SKILL_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSkill}
                className="px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold"
              >
                + Add
              </button>
            </div>

            {/* List of Structured Skills */}
            {skills.length > 0 && (
              <div className="space-y-1.5 mt-2.5">
                {skills.map((skill, idx) => (
                  <div
                    key={skill.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
                  >
                    <span className="font-semibold text-text-primary">{skill.name}</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={skill.level || 'Advanced'}
                        onChange={(e) => handleUpdateSkillLevel(idx, e.target.value)}
                        className="bg-surface-hover border border-border rounded px-2 py-0.5 text-[11px] text-text-secondary font-medium"
                      >
                        {SKILL_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill.name)}
                        className="text-text-muted hover:text-rose-500 text-sm font-bold ml-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.skills && <p className="text-error text-xs mt-1.5">{errors.skills}</p>}
          </div>

          {/* Multiple Portfolio Links */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-text-secondary">Portfolio Links</label>
              <button
                type="button"
                onClick={handleAddPortfolio}
                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Plus size={13} />
                Add Link
              </button>
            </div>

            <div className="space-y-2">
              {portfolioLinks.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Title (e.g. Showreel)"
                    value={item.title}
                    onChange={(e) => handleUpdatePortfolio(idx, 'title', e.target.value)}
                    className="w-1/3 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={item.url}
                    onChange={(e) => handleUpdatePortfolio(idx, 'url', e.target.value)}
                    className="flex-1 bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                  />
                  {portfolioLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePortfolio(idx)}
                      className="text-text-muted hover:text-rose-500 p-1"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {errors.portfolio && <p className="text-error text-xs mt-1.5">{errors.portfolio}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Short Professional Bio</label>
            <textarea
              rows={3}
              placeholder="Brief summary of your skills, background, and what you specialize in..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`w-full bg-surface border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors ${
                errors.bio ? 'border-error' : 'border-border'
              }`}
            />
            {errors.bio && <p className="text-error text-xs mt-1.5">{errors.bio}</p>}
          </div>

          {/* CV Upload */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">CV Document Upload</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCvFileChange}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <div 
              className={`border-2 border-dashed rounded-card p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-hover transition-colors ${
                errors.cv ? 'border-error bg-error/5' : 'border-border'
              }`}
              onClick={handleCvUploadSim}
            >
              <Upload className={errors.cv ? 'text-error mb-1.5' : 'text-text-muted mb-1.5'} size={22} />
              <p className="text-xs text-text-primary font-semibold">Click to upload CV (auto-extracts skills)</p>
              <p className="text-[10px] text-text-muted mt-0.5">PDF, DOC, DOCX up to 10MB</p>
              {cvFileName && (
                <p className="text-xs text-emerald-500 mt-2 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Attached: {cvFileName}
                </p>
              )}
            </div>
            {errors.cv && <p className="text-error text-xs mt-1.5">{errors.cv}</p>}
          </div>

          <Button fullWidth className="mt-6" onClick={handleSave}>
            {isProfileComplete ? 'Save Pro Profile' : 'Complete Setup'}
          </Button>
        </div>

        {/* Profile Photo Modal */}
        <ProfilePhotoModal
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          currentPhoto={avatarUrl}
          userInitial={name ? name.charAt(0).toUpperCase() : 'TF'}
          userName={name || 'Freelancer'}
          onSave={(newPhoto) => {
            setAvatarUrl(newPhoto);
            if (setProfilePhoto) setProfilePhoto(newPhoto);
            saveUserPhoto(userId, newPhoto);
            setImgError(false);
          }}
          onRemove={() => {
            setAvatarUrl('');
            if (setProfilePhoto) setProfilePhoto(null);
            removeUserPhoto(userId);
            setImgError(false);
          }}
        />
      </div>
    </PageTransition>
  );
};

export default ProfileSetup;

