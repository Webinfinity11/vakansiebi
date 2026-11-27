import { UiText } from '@/app/ui-language';
import {
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  MessageSquareText,
  Plus,
  Search,
  Send,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';

/* One readable idea per feature, drawn in the cabinet's own look. Text stays at a
   size people can read; names and numbers are illustrative. Decorative: the
   card's heading and text say the same thing. */
export type FeatureArtKind =
  'board' | 'cv' | 'analytics' | 'team' | 'company' | 'messages';

const stages = [
  { stage: 'new', Icon: Plus, label: 'ახალი', count: 3 },
  { stage: 'interview', Icon: MessageSquareText, label: 'გასაუბრებაზე', count: 2 },
  { stage: 'offer', Icon: BriefcaseBusiness, label: 'შეთავაზებული', count: 1 },
];
const team = [
  { initials: 'ნ.ბ.', Icon: ShieldCheck, role: 'მფლობელი', can: 'ყველაფერი' },
  { initials: 'გ.კ.', Icon: Users, role: 'რეკრუტერი', can: 'კანდიდატები' },
  { initials: 'მ.ჯ.', Icon: Eye, role: 'მნახველი', can: 'მხოლოდ ნახვა' },
];

export function FeatureArt({ kind }: { kind: FeatureArtKind }) {
  return (
    <div className={`fa fa--${kind}`} aria-hidden="true">
      {kind === 'board' && (
        <div className="fa-flow">
          {stages.map(({ stage, Icon, label, count }, index) => (
            <span key={stage} className="fa-flow-item">
              {index > 0 && <ArrowRight className="fa-flow-arrow" size={14} />}
              <span className="fa-stage" data-stage={stage}>
                <Icon size={14} strokeWidth={2} />
                <UiText>{label}</UiText>
                <b>{count}</b>
              </span>
            </span>
          ))}
        </div>
      )}
      {kind === 'cv' && (
        <div className="fa-panel fa-cv">
          <span className="fa-search">
            <Search size={14} />
            <UiText>ბუღალტერი, 1C</UiText>
          </span>
          <span className="fa-found">
            <span className="fa-faces">
              <i data-tone="0" />
              <i data-tone="1" />
              <i data-tone="2" />
            </span>
            <strong>
              <UiText>12 შესაბამისი CV</UiText>
            </strong>
          </span>
        </div>
      )}
      {kind === 'analytics' && (
        <div className="fa-metrics">
          <span className="fa-metric">
            <strong>1 427</strong>
            <UiText>ნახვა</UiText>
            <em>
              <TrendingUp size={12} /> 12%
            </em>
          </span>
          <span className="fa-metric">
            <strong>38</strong>
            <UiText>განაცხადი</UiText>
            <em>
              <TrendingUp size={12} /> 8%
            </em>
          </span>
        </div>
      )}
      {kind === 'team' && (
        <div className="fa-panel fa-team">
          {team.map(({ initials, Icon, role, can }, index) => (
            <span key={initials} className="fa-member">
              <i data-tone={index}>
                <UiText>{initials}</UiText>
              </i>
              <strong>
                <Icon size={13} strokeWidth={2} />
                <UiText>{role}</UiText>
              </strong>
              <small>
                <UiText>{can}</UiText>
              </small>
            </span>
          ))}
        </div>
      )}
      {kind === 'company' && (
        <div className="fa-panel fa-company">
          <span className="fa-company-head">
            <i>
              <UiText>კ</UiText>
            </i>
            <span>
              <strong>
                <UiText>თქვენი კომპანია</UiText>
              </strong>
              <small>
                <UiText>ჩანს ყველა ვაკანსიაზე</UiText>
              </small>
            </span>
          </span>
          <span className="fa-benefits">
            <em>
              <UiText>დაზღვევა</UiText>
            </em>
            <em>
              <UiText>ტრენინგები</UiText>
            </em>
            <em>
              <UiText>ბონუსი</UiText>
            </em>
          </span>
        </div>
      )}
      {kind === 'messages' && (
        <div className="fa-panel fa-message">
          <span className="fa-message-text">
            <UiText>გამარჯობა, ნინო! გიწვევთ გასაუბრებაზე.</UiText>
          </span>
          <span className="fa-send">
            <Send size={13} />
            <UiText>გაგზავნა</UiText>
          </span>
        </div>
      )}
    </div>
  );
}
