import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { HelpCircle, Mail, Phone, Clock, FileText, Send, CheckCircle2 } from 'lucide-react';
import api from '../../utils/api';

const SupportPage = () => {
  const [formData, setFormData] = useState({
    contactName: '',
    contactPhone: '',
    creatorType: 'user',
    subject: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.contactName || !formData.contactPhone || !formData.subject || !formData.description) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/support/public-ticket', formData);
      if (res.data?.success) {
        toast.success('Support ticket raised successfully!');
        setSubmittedTicket(res.data.ticket);
        setFormData({
          contactName: '',
          contactPhone: '',
          creatorType: 'user',
          subject: '',
          description: '',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to raise support ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-16 md:py-24 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-amber-600 text-xs font-semibold shadow-sm">
            <HelpCircle className="w-3 h-3" /> Help Desk
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-950">
            Raise a Support Ticket
          </h1>
          <p className="text-slate-500 text-lg font-medium">
            Need help or have questions? Submit a ticket below, and our support team will get back to you shortly.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Info Panels */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6">
              <h3 className="text-xl font-bold text-slate-950">Contact Information</h3>
              <p className="text-slate-500 text-sm font-medium">
                Our support team is available 24/7 to assist you. Choose whichever channel is most convenient for you.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4 text-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Call Us</p>
                    <p className="text-sm font-bold text-slate-900">+91 98765 43210</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Email Support</p>
                    <p className="text-sm font-bold text-slate-900">support@searchmydriver.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-600">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase">Response Time</p>
                    <p className="text-sm font-bold text-slate-900">Usually under 15 minutes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Panel */}
          <div className="lg:col-span-7">
            {submittedTicket ? (
              <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-950">Ticket Submitted successfully!</h3>
                  <p className="text-slate-500 font-medium">
                    Thank you. Your support ticket has been logged and assigned to our help desk team.
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left space-y-3 max-w-md mx-auto">
                  <div className="flex justify-between text-xs text-slate-400 font-bold">
                    <span>TICKET ID:</span>
                    <span className="text-slate-700">{submittedTicket._id}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-bold">
                    <span>NAME:</span>
                    <span className="text-slate-700">{submittedTicket.contactName}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-bold">
                    <span>SUBJECT:</span>
                    <span className="text-slate-700">{submittedTicket.subject}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-bold">
                    <span>STATUS:</span>
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase text-[10px]">
                      {submittedTicket.status || 'Pending'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSubmittedTicket(null)}
                  className="px-6 py-2.5 rounded-full bg-amber-500 text-black font-extrabold text-sm hover:bg-amber-400 transition-all shadow-sm"
                >
                  Submit Another Ticket
                </button>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Contact Name
                      </label>
                      <input
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleChange}
                        placeholder="John Doe"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        name="contactPhone"
                        value={formData.contactPhone}
                        onChange={handleChange}
                        placeholder="9876543210"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      I am a...
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="creatorType"
                          value="user"
                          checked={formData.creatorType === 'user'}
                          onChange={handleChange}
                          className="accent-amber-500 h-4 w-4"
                        />
                        Customer / Car Owner
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                        <input
                          type="radio"
                          name="creatorType"
                          value="driver"
                          checked={formData.creatorType === 'driver'}
                          onChange={handleChange}
                          className="accent-amber-500 h-4 w-4"
                        />
                        Partner Driver
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="e.g. Issue with booking payment"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Describe your Issue
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Please provide details about the problem you are experiencing..."
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50 text-slate-900 resize-none"
                      required
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Support Ticket'} <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
