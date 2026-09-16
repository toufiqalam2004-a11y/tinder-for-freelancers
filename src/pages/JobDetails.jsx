import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ExternalLink, MapPin, DollarSign, Bookmark, BookmarkCheck, 
  Clock, Building2, Briefcase, Globe, Send, Facebook, User 
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import PageTransition from '../components/PageTransition';
import Card from '../components/Card';
import Button from '../components/Button';
import SkillTag from '../components/SkillTag';
import { getJobById, updateJobStatus, recordJobView } from '../data/storage.js';
import { JOB_TYPE_LABELS } from '../utils/constants';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const data = getJobById(id);
    if (data) {
      setJob(data);
      setIsSaved(data.status === 'saved');
      recordJobView(id);
    } else {
      toast.error('Job not found');
      navigate(-1);
    }
  }, [id, navigate]);

  if (!job) return null;

  const handleSave = () => {
    const newStatus = isSaved ? 'discovered' : 'saved';
    updateJobStatus(job.id, newStatus);
    setIsSaved(!isSaved);
    toast.success(isSaved ? 'Removed from saved jobs' : 'Job saved!');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-500 border-emerald-500';
    if (score >= 60) return 'text-amber-500 border-amber-500';
    return 'text-rose-500 border-rose-500';
  };

  return (
    <PageTransition>
      <div className="max-w-md mx-auto px-5 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-text-secondary hover:text-text-primary transition-colors"
          >
            <ChevronLeft size={24} className="mr-1" />
            <span>Back</span>
          </button>
          
          {job.url && (
            <a 
              href={job.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary p-2 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
            >
              <ExternalLink size={18} />
            </a>
          )}
        </div>

        {/* Job Title & Company */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-text-primary mb-2">{job.title}</h1>
          <div className="flex items-center text-text-secondary text-sm">
            {job.platform === 'facebook_group' ? (
              <Facebook size={16} className="mr-1.5 text-[#1877F2]" />
            ) : job.platform === 'reddit' ? (
              <span className="mr-1.5 font-bold text-[#FF4500]">r/</span>
            ) : job.platform === 'youtube' ? (
              <span className="mr-1.5 font-bold text-[#FF0000]">YT:</span>
            ) : job.platform === 'x' ? (
              <span className="mr-1.5 font-bold text-text-primary">X:</span>
            ) : (
              <Building2 size={16} className="mr-1.5 text-text-muted" />
            )}
            <span className="font-medium text-text-primary">{job.company || job.client || job.author || 'Hiring Client'}</span>
          </div>
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary capitalize border border-primary/20">
            {job.platform.replace('_', ' ')}
          </div>
          {job.jobQuality && (
            <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              job.jobQuality === 'High Quality'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            }`}>
              {job.jobQuality}
            </div>
          )}
          {job.isDemo && (
            <div className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              DEMO
            </div>
          )}
          {job.jobType && (
            <div className="px-3 py-1 rounded-full text-xs font-medium bg-surface-hover text-text-primary capitalize border border-border">
              {JOB_TYPE_LABELS?.[job.jobType] || job.jobType}
            </div>
          )}
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${job.remote ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-surface-hover text-text-muted border-border'}`}>
            {job.remote ? 'Remote' : 'On-site'}
          </div>
        </div>

        {/* Risk Signal Alert (if any) */}
        {job.riskSignals && job.riskSignals.length > 0 && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <span className="font-bold">⚠️ Caution Signal:</span>
            <span>{job.riskSignals.join(' • ')}</span>
          </div>
        )}

        {/* Match Score & Multi-Factor Breakdown */}
        <Card className="mb-6 flex flex-col items-start gap-4 p-5">
          <div className="flex items-center gap-4 w-full">
            <div className={`relative flex items-center justify-center w-16 h-16 rounded-full border-4 flex-shrink-0 ${getScoreColor(job.matchScore)}`}>
              <span className="text-lg font-bold text-text-primary">{job.matchScore}%</span>
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-sm">Match Confidence Analysis</h3>
              <p className="text-xs text-text-muted">Calculated using 8 weighted profile dimensions</p>
            </div>
          </div>

          <div className="w-full space-y-2 pt-2 border-t border-border">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Why this matches:</h4>
            {job.matchReasons && job.matchReasons.length > 0 ? (
              <ul className="text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
                {job.matchReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5 font-medium">
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">No specific match reasons available.</p>
            )}

            {job.matchCautionReasons && job.matchCautionReasons.length > 0 && (
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 pt-1">
                {job.matchCautionReasons.map((caution, i) => (
                  <li key={i} className="flex items-start gap-1.5 font-medium">
                    <span>{caution}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>


        <hr className="border-border my-6" />

        {/* Description */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-text-primary mb-3">Job Description</h2>
          <div className="text-text-secondary text-sm whitespace-pre-wrap leading-relaxed">
            {job.description}
          </div>
        </div>

        {/* Required Skills */}
        {((job.requiredSkills && job.requiredSkills.length > 0) || (job.skills && job.skills.length > 0)) && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Required Skills</h2>
            <div className="flex flex-wrap gap-2">
              {(job.requiredSkills || job.skills).map((skill, index) => (
                <SkillTag key={index} label={skill} />
              ))}
            </div>
          </div>
        )}

        {/* Info Rows */}
        <div className="space-y-4 mb-6 bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-start">
            <DollarSign size={18} className="text-text-muted mr-3 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted">Salary</p>
              <p className="text-sm text-text-primary font-medium">{job.salary || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-start">
            <MapPin size={18} className="text-text-muted mr-3 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted">Location</p>
              <p className="text-sm text-text-primary font-medium">{job.location || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-start">
            <Briefcase size={18} className="text-text-muted mr-3 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted">Experience</p>
              <p className="text-sm text-text-primary font-medium">{job.experience || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-start">
            <Globe size={18} className="text-text-muted mr-3 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted">Contact Method</p>
              <p className="text-sm text-text-primary font-medium">{job.contactMethod || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-start">
            <Clock size={18} className="text-text-muted mr-3 mt-0.5" />
            <div>
              <p className="text-xs text-text-muted">Posted</p>
              <p className="text-sm text-text-primary font-medium">
                {new Date(job.postedAt || Date.now()).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface border-t border-border p-4 pb-8 flex gap-3 z-10 shadow-lg">
          <Button 
            variant="outline" 
            className="flex-1 flex justify-center items-center gap-2"
            onClick={handleSave}
          >
            {isSaved ? <BookmarkCheck size={20} className="text-primary" /> : <Bookmark size={20} />}
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          <Button 
            variant="primary" 
            className="flex-[2] flex justify-center items-center gap-2 text-white"
            onClick={() => navigate(`/apply/${job.id}`)}
          >
            <Send size={20} />
            Apply Now
          </Button>
        </div>
      </div>
    </PageTransition>
  );
};

export default JobDetails;
