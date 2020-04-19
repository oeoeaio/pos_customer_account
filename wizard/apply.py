from odoo import models, fields, api
from odoo.exceptions import UserError, ValidationError

import logging

_logger = logging.getLogger(__name__)

class Apply(models.TransientModel):
    _name = 'pos.customer.account.apply'
    _register = False

    def _default_counterpart_account(self):
        raise NotImplementedError("In order to apply a credit/debit, method _default_counterpart_account must be implemented")

    partner = fields.Many2one('res.partner', required=True, string="Customer")
    counterpart_account = fields.Many2one('account.account', required=True, string="From Account")
    label = fields.Char("Description", required=True, help="A description of the reason for the credit/debit")
    reference = fields.Char("Reference", help="A reference number (eg. transaction or order number)")
    amount = fields.Float("Amount", required=True, default=0.0)

    @api.constrains('amount')
    def _check_phone_number(self):
        for rec in self:
            if (not rec.amount) or rec.amount == 0.0:
                raise ValidationError("Please enter a non-zero amount")
        return True

    @api.model
    def default_get(self, fields):
        result = super(Apply, self).default_get(fields)
        result['partner'] = self._context.get('active_partner_id', False)
        result['counterpart_account'] = self._default_counterpart_account().id
        return result

    def action_apply(self):
        account_id = self.env.ref('pos_customer_account.customer_account_account').id
        journal_id = self.env.ref('pos_customer_account.pos_customer_account_journal').id
        amount = self.amount

        move = self._create_account_move(fields.Datetime.now(), self.reference, int(journal_id))
        lines = [(0,0,{
            'name': self.label,
            'move_id': move.id,
            'account_id': account_id,
            'partner_id': self.partner.id,
            'credit': (self._is_credit() and amount) or 0.0,
            'debit': (self._is_debit() and amount) or 0.0,
        }),(0,0,{
            'name': self.label,
            'move_id': move.id,
            'account_id': self.counterpart_account.id,
            'partner_id': self.partner.id,
            'credit': (self._is_debit() and amount) or 0.0,
            'debit': (self._is_credit() and amount) or 0.0,
        })]
        move.sudo().write({'line_ids': lines})
        move.sudo().post()
        return {}

    def _create_account_move(self, dt, ref, journal_id):
        date_tz_user = fields.Datetime.context_timestamp(self, fields.Datetime.from_string(dt))
        date_tz_user = fields.Date.to_string(date_tz_user)
        return self.env['account.move'].sudo().create({'ref': ref, 'journal_id': journal_id, 'date': date_tz_user})


class ApplyCredit(Apply):
    _name = 'pos.customer.account.apply.credit'

    def _default_counterpart_account(self):
        return self.env.ref('l10n_au.1_au_11110')

    def _is_credit(self):
        return True

    def _is_debit(self):
        return False

class ApplyDebit(Apply):
    _name = 'pos.customer.account.apply.debit'

    def _default_counterpart_account(self):
        return self.env.ref('l10n_au.1_au_11200')

    def _is_credit(self):
        return False

    def _is_debit(self):
        return True
