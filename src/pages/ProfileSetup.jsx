import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, ChevronLeft, Plus, Trash2, CheckCircle2, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Input from '../components/Input';
import Button from '../components/Button';
import Card from '../components/Card';
import { useProfile } from '../contexts/ProfileContext';
import { CATEGORIES, EXPERIENCE_LEVELS, SKILL_LEVELS, JOB_TYPES, REMOTE_OPTIONS } from '../utils/constants';
import { calculateProfileStrength } from '../services/proMatchEngine';
import { aiService } from '../services/aiService';
import toast from 'react-hot-toast';

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { profile, saveProfile, isProfileComplete } = useProfile();
  
  const [name, setName] = useState(profile?.name || '');
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

  const handleSave = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (!profession.trim() && !primaryRole.trim()) newErrors.profession = 'Primary role is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const primaryPort = portfolioLinks.find((p) => p.isPrimary)?.url || portfolioLinks[0]?.url || '';

    saveProfile({
      name,
      profession: primaryRole || profession,
      primaryRole: primaryRole || profession,
      secondaryRoles,
      category: category || 'Creative',
      specialization: specialization || primaryRole || profession,
      experience,
      yearsOfExperience: Number(yearsOfExperience),
      bio,
      skills,
      portfolioUrl: primaryPort,
      portfolioLinks: portfolioLinks.filter((p) => p.url.trim().length > 0),
      cvUrl: cvFileName ? 'uploaded' : null,
      preferredJobTypes,
      remotePreference,
      expectedSalaryMin: Number(expectedSalaryMin),
      expectedSalaryMax: Number(expectedSalaryMax),
      currency,
      availability,
    });

    toast.success('Pro Profile saved successfully!');
    navigate('/jobs');
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
            <label className="block text-sm text-text-secondary mb-1">Secondary / Adjacent Roles</label>
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
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
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
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm text-text-secondary mb-1">Short Professional Bio</label>
            <textarea
              rows={3}
              placeholder="Brief summary of your skills, background, and what you specialize in..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* CV Upload */}
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">CV Upload & Skill Extractor</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCvFileChange}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
            <div 
              className="border-2 border-dashed border-border rounded-card p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-hover transition-colors"
              onClick={handleCvUploadSim}
            >
              <Upload className="text-text-muted mb-1.5" size={22} />
              <p className="text-xs text-text-primary font-semibold">Click to upload CV (auto-extracts skills)</p>
              <p className="text-[10px] text-text-muted mt-0.5">PDF, DOC, DOCX up to 10MB</p>
              {cvFileName && (
                <p className="text-xs text-emerald-500 mt-2 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Attached: {cvFileName}
                </p>
              )}
            </div>
          </div>

          <Button fullWidth className="mt-6" onClick={handleSave}>
            {isProfileComplete ? 'Save Pro Profile' : 'Complete Setup'}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default ProfileSetup;

