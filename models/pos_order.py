import logging

from odoo import models, fields, api
from odoo.addons import decimal_precision as dp

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def _process_order(self, order, draft, existing_order):
        order_id = super(PosOrder, self)._process_order(order, draft, existing_order)
        order = self.env['pos.order'].browse(order_id)
        self._handle_customer_account_payment_product(order)
        return order_id

    def _handle_customer_account_payment_product(self, order):
        account_payment_product_id = self.env.ref('pos_customer_account.account_payment_product').id
        for line in order.lines:
            if line.product_id.id != account_payment_product_id:
                continue
            self._apply_customer_account_payment(
              line.price_subtotal,
              order.partner_id.id,
              order.date_order,
              f"Credit added in POS session ({order.session_id.name})",
              order.name,
            )

    def _apply_customer_account_payment(self, credit, partner_id, date, reference, label):
        journal_id = self.env.ref('pos_customer_account.pos_customer_account_journal').id
        account_id = self.env.ref('pos_customer_account.customer_account_account').id
        counterpart_account_id = self.env.ref('l10n_au.1_au_11200').id

        move = self._create_account_move(date, reference, journal_id)
        self.env['ir.model.data'].create({'name': label, 'model': 'account.move', 'res_id': move.id})
        lines = [(0,0,{
            'name': label,
            'move_id': move.id,
            'account_id': account_id,
            'partner_id': partner_id,
            'credit': credit,
            'debit': 0.0,
        }),(0,0,{
            'name': label,
            'move_id': move.id,
            'account_id': counterpart_account_id,
            'partner_id': partner_id,
            'credit': 0.0,
            'debit': credit,
        })]
        _logger.info(str(lines))
        move.sudo().write({'line_ids': lines})
        move.sudo().post()
        return {}

    def _create_account_move(self, date, ref, journal_id):
        return self.env['account.move'].sudo().create({'ref': ref, 'journal_id': journal_id, 'date': date})
