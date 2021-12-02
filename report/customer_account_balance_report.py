# -*- coding: utf-8 -*-

import time
from odoo import api, fields, models

class CustomerAccountBalance(models.AbstractModel):
    _name = 'report.account.report_customer_account_balance'

    def _get_account_move_lines(self, customer_ids):
        res = {x: [] for x in customer_ids}

        customers = self.env['res.partner'].browse(customer_ids)

        for customer in customers:
            for line in customer.account_lines.sorted('date'):
                res[customer.id].append({
                    'date': line.date,
                    'ref': line.ref,
                    'name': line.name,
                    'debit': line.debit,
                    'credit': line.credit,
                    'currency_id': line.currency_id,
                    'amount_currency': line.amount_currency,
                })
        return res

    @api.model
    def get_report_values(self, docids, data=None):
        totals = {}
        lines = self._get_account_move_lines(docids)
        lines_to_display = {}
        company_currency = self.env.user.company_id.currency_id
        for partner_id in docids:
            lines_to_display[partner_id] = {}
            totals[partner_id] = {}
            for line_tmp in lines[partner_id]:
                line = line_tmp.copy()

                if line['credit'] == 0 and line['debit'] == 0:
                    continue

                currency = line['currency_id'] and self.env['res.currency'].browse(line['currency_id']) or company_currency
                if currency not in lines_to_display[partner_id]:
                    lines_to_display[partner_id][currency] = []
                    totals[partner_id][currency] = dict((fn, 0.0) for fn in ['due', 'paid', 'balance'])
                if line['debit'] and line['currency_id']:
                    line['debit'] = line['amount_currency']
                if line['credit'] and line['currency_id']:
                    line['credit'] = line['amount_currency']

                totals[partner_id][currency]['due'] += line['debit']
                totals[partner_id][currency]['paid'] += line['credit']
                totals[partner_id][currency]['balance'] += line['credit'] - line['debit']

                line['running_balance'] = totals[partner_id][currency]['balance']
                lines_to_display[partner_id][currency].append(line)

            for currency in lines_to_display[partner_id]:
                lines_to_display[partner_id][currency].reverse()
                del lines_to_display[partner_id][currency][7:]
        return {
            'doc_ids': docids,
            'doc_model': 'res.partner',
            'docs': self.env['res.partner'].browse(docids),
            'time': time,
            'Lines': lines_to_display,
            'Totals': totals,
            'Date': fields.date.today(),
        }
