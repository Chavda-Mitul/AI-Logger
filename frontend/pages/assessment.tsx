import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { projectsApi, assessmentsApi, type Project, type Assessment } from '../lib/api';

export default function AssessmentPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [existingAssessment, setExistingAssessment] = useState<Assessment | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Wizard form state
  const [formData, setFormData] = useState({
    // Step 1: Basic Info
    company_name: '',
    email: '',
    // Step 2: AI System Type
    system_type: '',
    interacts_with_humans: '',
    generates_content: '',
    makes_decisions: '',
    // Step 3: Risk Factors
    biometric_data: '',
    evaluates_people: '',
    social_scoring: '',
    manipulates_behavior: '',
    // Step 4: Data & Privacy
    processes_personal_data: '',
    special_categories_data: '',
    // Step 5: Impact Assessment
    severity: '',
    likelihood: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const { projects: list } = await projectsApi.list();
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id);
          
          // Check for existing assessment
          try {
            const { assessment } = await assessmentsApi.getByProject(list[0].id);
            setExistingAssessment(assessment);
          } catch (e) {
            // No assessment yet
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateRiskTier = () => {
    // Simplified risk calculation based on EU AI Act
    const riskFactors = [
      formData.biometric_data === 'yes',
      formData.evaluates_people === 'yes',
      formData.social_scoring === 'yes',
      formData.manipulates_behavior === 'yes',
      formData.severity === 'high',
      formData.likelihood === 'high',
    ];
    
    const score = riskFactors.filter(Boolean).length;
    
    if (formData.social_scoring === 'yes') return 'PROHIBITED';
    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'LIMITED';
    return 'MINIMAL';
  };

  const calculateScore = () => {
    // Simplified compliance score calculation
    let score = 100;
    
    // Deductions based on risk factors
    if (formData.interacts_with_humans === 'yes') score -= 10;
    if (formData.generates_content === 'yes') score -= 5;
    if (formData.makes_decisions === 'yes') score -= 15;
    if (formData.biometric_data === 'yes') score -= 15;
    if (formData.evaluates_people === 'yes') score -= 20;
    if (formData.manipulates_behavior === 'yes') score -= 20;
    if (formData.processes_personal_data === 'yes') score -= 10;
    if (formData.special_categories_data === 'yes') score -= 15;
    
    return Math.max(0, score);
  };

  const generateObligations = () => {
    const tier = calculateRiskTier();
    const obligations: Record<string, any> = {};
    
    if (tier === 'PROHIBITED') {
      obligations.prohibition = { title: 'Prohibited System', description: 'This AI system type is prohibited under EU AI Act', required: true };
    }
    
    if (formData.interacts_with_humans === 'yes' || formData.makes_decisions === 'yes') {
      obligations.transparency = { title: 'Transparency Requirements', description: 'Must disclose AI usage to users', required: true };
    }
    
    if (formData.evaluates_people === 'yes' || formData.biometric_data === 'yes') {
      obligations.fundamental_rights = { title: 'Fundamental Rights Impact', description: 'Conduct fundamental rights impact assessment', required: true };
    }
    
    if (formData.processes_personal_data === 'yes') {
      obligations.data_governance = { title: 'Data Governance', description: 'Implement data governance measures', required: true };
    }
    
    if (formData.generates_content === 'yes') {
      obligations.content_moderation = { title: 'Content Moderation', description: 'Implement content moderation and disclosure', required: true };
    }
    
    // General obligations
    obligations.risk_assessment = { title: 'Risk Assessment', description: 'Complete and maintain risk assessment documentation', required: true };
    obligations.documentation = { title: 'Technical Documentation', description: 'Maintain comprehensive technical documentation', required: true };
    
    return obligations;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const riskTier = calculateRiskTier();
      const complianceScore = calculateScore();
      const obligations = generateObligations();
      
      const documentsRequired = [
        'technical_doc',
        'risk_plan',
      ];
      
      if (riskTier === 'HIGH' || riskTier === 'LIMITED') {
        documentsRequired.push('bias_assessment', 'human_oversight');
      }
      
      if (formData.processes_personal_data === 'yes') {
        documentsRequired.push('data_governance');
      }

      await assessmentsApi.create({
        project_id: selectedProjectId,
        email: formData.email,
        company_name: formData.company_name,
        answers: formData,
        risk_tier: riskTier,
        compliance_score: complianceScore,
        obligations,
        documents_required: documentsRequired,
        dpdp_applicable: formData.processes_personal_data === 'yes',
        estimated_effort: complianceScore > 70 ? 'Low' : complianceScore > 40 ? 'Medium' : 'High',
        urgency: riskTier === 'PROHIBITED' || riskTier === 'HIGH' ? 'immediate' : riskTier === 'LIMITED' ? '3_months' : '6_months',
      });

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
        </div>
      </Layout>
    );
  }

  if (success) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete!</h2>
            <p className="text-gray-600 mb-6">
              Your EU AI Act risk assessment has been saved. View your compliance dashboard to see your score and obligations.
            </p>
            <a href="/dashboard" className="btn-primary">
              View Dashboard
            </a>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">EU AI Act Risk Assessment</h1>
          <p className="text-gray-500 mt-1">Complete this assessment to determine your compliance requirements</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Step {step} of 5</span>
            <span className="text-sm text-gray-500">{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-brand-500 h-2 rounded-full transition-all"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Project Selector */}
        {step === 1 && (
          <div className="card mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="input w-full"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {existingAssessment && (
              <p className="text-sm text-yellow-600 mt-2">
                ⚠️ An assessment already exists. Submitting will update it.
              </p>
            )}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="Your company name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="contact@company.com"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: AI System Type */}
        {step === 2 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">AI System Type</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What type of AI system are you using?</label>
                <select name="system_type" value={formData.system_type} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="chatbot">Chatbot / Virtual Assistant</option>
                  <option value="content_generation">Content Generation</option>
                  <option value="decision_making">Decision Making / Scoring</option>
                  <option value="recommendation">Recommendation System</option>
                  <option value="computer_vision">Computer Vision</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does the system interact with humans?</label>
                <select name="interacts_with_humans" value={formData.interacts_with_humans} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it generate content (text, images, etc.)?</label>
                <select name="generates_content" value={formData.generates_content} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it make decisions that affect people?</label>
                <select name="makes_decisions" value={formData.makes_decisions} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Risk Factors */}
        {step === 3 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Risk Factors</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it process biometric data?</label>
                <select name="biometric_data" value={formData.biometric_data} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it evaluate or score people?</label>
                <select name="evaluates_people" value={formData.evaluates_people} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Is it used for social scoring?</label>
                <select name="social_scoring" value={formData.social_scoring} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it manipulate human behavior?</label>
                <select name="manipulates_behavior" value={formData.manipulates_behavior} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Data & Privacy */}
        {step === 4 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Data & Privacy</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it process personal data?</label>
                <select name="processes_personal_data" value={formData.processes_personal_data} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Does it process special category data (health, biometric, etc.)?</label>
                <select name="special_categories_data" value={formData.special_categories_data} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Impact */}
        {step === 5 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Impact Assessment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What is the potential severity of harm?</label>
                <select name="severity" value={formData.severity} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What is the likelihood of harm?</label>
                <select name="likelihood" value={formData.likelihood} onChange={handleInputChange} className="input w-full">
                  <option value="">Select...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Preview Results */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Preview Results</h3>
              <p className="text-sm">
                Risk Tier: <span className="font-medium">{calculateRiskTier()}</span>
              </p>
              <p className="text-sm">
                Compliance Score: <span className="font-medium">{calculateScore()}/100</span>
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="btn-secondary"
          >
            Back
          </button>
          
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-primary"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Submitting...' : 'Complete Assessment'}
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 mt-4">{error}</p>
        )}
      </div>
    </Layout>
  );
}
