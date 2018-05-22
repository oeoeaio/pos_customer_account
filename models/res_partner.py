import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)

class ResPartner(models.Model):
    _inherit = "res.partner"

    @api.depends('account_lines','account_lines.credit','account_lines.debit')
    def _compute_balance_all(self):
        for partner in self:
            balance = 0
            for line in partner.account_lines:
                balance -= line.debit
                balance += line.credit
            partner.account_balance = balance

    def _account_lines_domain(self):
        account = self.env.ref('pos_customer_account.customer_account_account', False)
        account_id = account and account.id
        return [('account_id', '=', account_id)]

    account_lines = fields.One2many('account.move.line', 'partner_id', domain=_account_lines_domain)
    account_balance = fields.Float(compute=_compute_balance_all, string='Balance', store=True)
