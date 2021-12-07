# -*- coding: utf-8 -*-

import time, re
from odoo import api, fields, models

class CustomerAccountBalance(models.AbstractModel):
    _name = 'report.account.report_customer_account_balance'

    def _account_payment(self, line):
        match = re.search('^Account Payment$', line.name or '')
        if match:
            return 'Account Payment (at the hub)'

    def _eft_payment(self, line):
        match = re.search('^EFT-\d+-\d+$', line.name or '')
        if match:
            return 'EFT Payment ({ref})'.format(ref=line.ref)

    def _stripe_payment(self, line):
        ref_match = re.search('^OFN-STRIPE$', line.ref or '')
        name_match = re.search('^R\d+$', line.name or '')
        if ref_match and name_match:
            return 'Card Payment (OFN - {ofn_order_no})'.format(ofn_order_no=line.name)

    def _get_line_description(self, line):
        if line['credit']:
            credit_functions = [self._account_payment, self._eft_payment, self._stripe_payment]
            for function in credit_functions:
                result = function(line)
                if result:
                  return result
            return 'Account Credit ({name} {ref})'.format(name=line.name, ref=line.ref)
        else:
            match = re.search('POS/\d{4}/\d{2}/\d{2}/(\d+)', line.ref or '')
            if match:
                return 'Account Purchase ({name} {order_no})'.format(name=line.name, order_no=match.group(1))
            else:
                return 'Account Purchase ({name} {ref})'.format(name=line.name, ref=line.ref)

    def _get_account_move_lines(self, customer_ids):
        res = {x: [] for x in customer_ids}

        customers = self.env['res.partner'].browse(customer_ids)

        for customer in customers:
            for line in customer.account_lines.sorted('date'):
                res[customer.id].append({
                    'date': line.date,
                    'description': self._get_line_description(line),
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
        return {
            'doc_ids': docids,
            'doc_model': 'res.partner',
            'docs': self.env['res.partner'].browse(docids),
            'time': time,
            'currency': company_currency,
            'Lines': lines_to_display,
            'Totals': totals,
            'Date': fields.date.today(),
        }
